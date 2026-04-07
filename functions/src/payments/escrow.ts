// ─────────────────────────────────────────────────────────────────────────────
// Escrow helpers — used by triggers, queue, and webhook handlers
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions'
import { db, serverTimestamp } from '../_shared/helpers'
import { logger, auditLog } from '../_shared/monitoring'
import { tapRequestWithRetry } from '../_shared/webhooks'
import type { Order } from '@workfix/types'

const TAP_BASE = 'https://api.tap.company/v2'

function tapHeaders() {
  const apiKey = process.env['TAP_SECRET_KEY']
  if (!apiKey) throw new Error('TAP_SECRET_KEY missing')
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

/** Release Escrow (capture) — money goes to platform, then payout to provider */
export async function releaseEscrowById(orderId: string): Promise<void> {
  const orderDoc = await db.collection('orders').doc(orderId).get()
  if (!orderDoc.exists) throw new Error(`Order not found: ${orderId}`)

  const order = orderDoc.data() as Order
  if (!order.escrowPaymentId || order.paymentMethod === 'cash') return
  if ((order as unknown as Record<string, unknown>)['escrowFrozen'] === true) {
    logger.info('Escrow release blocked — order is frozen (active dispute)', { orderId })
    return
  }
  if (order.paymentStatus === 'captured') {
    logger.info('Escrow already captured', { orderId })
    return
  }

  try {
    const res = await tapRequestWithRetry(() =>
      fetch(`${TAP_BASE}/charges/${order.escrowPaymentId}/capture`, {
        method: 'POST', headers: tapHeaders(),
      }),
    )

    if (!res.ok) {
      const err = await res.json() as { message?: string }
      throw new Error(`Tap capture failed: ${err.message ?? res.status}`)
    }

    await db.collection('orders').doc(orderId).update({
      paymentStatus: 'captured',
      updatedAt:     serverTimestamp(),
    })

    await auditLog('escrow_released', order.providerId ?? 'system', {
      orderId, amount: order.finalPrice, chargeId: order.escrowPaymentId,
    })

    logger.payment('escrow_captured', {
      orderId, chargeId: order.escrowPaymentId, amount: order.finalPrice,
    })
  } catch (err) {
    logger.error('Escrow capture failed', err, { orderId })
    throw err
  }
}

/** Refund Escrow — money returns to customer */
export async function refundEscrowById(orderId: string, reason: string): Promise<void> {
  const orderDoc = await db.collection('orders').doc(orderId).get()
  if (!orderDoc.exists) throw new Error(`Order not found: ${orderId}`)

  const order = orderDoc.data() as Order
  if (!order.escrowPaymentId || order.paymentMethod === 'cash') return
  if (order.paymentStatus === 'refunded') {
    logger.info('Escrow already refunded', { orderId })
    return
  }
  // Refuse to refund unless the escrow is actually held by Tap.
  // Attempting a refund on an 'initiated' or 'captured' charge risks
  // double-charging the customer if the original payment later succeeds.
  if (order.paymentStatus !== 'held') {
    logger.warn('Refund skipped — paymentStatus is not held', { orderId, paymentStatus: order.paymentStatus })
    return
  }

  const minorMultiplier = ['KWD', 'BHD'].includes(order.currency ?? '') ? 1000 : 100
  const amountMinor = Math.round((order.finalPrice ?? 0) * minorMultiplier)

  try {
    const res = await tapRequestWithRetry(() =>
      fetch(`${TAP_BASE}/refunds`, {
        method: 'POST', headers: tapHeaders(),
        body: JSON.stringify({
          charge_id: order.escrowPaymentId,
          amount:    amountMinor,
          reason,
        }),
      }),
    )

    if (!res.ok) {
      const err = await res.json() as { message?: string }
      throw new Error(`Tap refund failed: ${err.message ?? res.status}`)
    }

    await db.collection('orders').doc(orderId).update({
      paymentStatus: 'refunded',
      updatedAt:     serverTimestamp(),
    })

    await auditLog('escrow_refunded', order.customerId, {
      orderId, amount: order.finalPrice, reason,
    })

    logger.payment('escrow_refunded', {
      orderId, amount: order.finalPrice, reason,
    })
  } catch (err) {
    logger.error('Escrow refund failed', err, { orderId })
    throw err
  }
}
