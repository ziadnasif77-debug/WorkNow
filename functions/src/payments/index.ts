// ─────────────────────────────────────────────────────────────────────────────
// Payments Functions
// Gateway: Tap Payments — supports MENA (SAR/AED/KWD...) + Scandinavia (NOK/SEK)
//          + Vipps (Norway) + Swish (Sweden) + Apple Pay + Cards everywhere
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { z } from 'zod'
import {
  callable, requireAuth, validate, db,
  serverTimestamp, appError, addSecurityHeaders,
} from '../_shared/helpers'
import { rateLimit } from '../_shared/ratelimit'
import { logger } from '../_shared/monitoring'
import type { Order, Payment, Currency, Timestamp } from '@workfix/types'
import { tapRequest, toTapSource } from '../_shared/tapClient'

// ── Tap Payments API client ───────────────────────────────────────────────────

/**
 * Map WorkFix PaymentMethod → Tap Payments source type
 *
 * Tap supports:
 *   MENA:          card (KNET, Mada, Visa, MC), apple_pay, stc_pay
 *   Scandinavia:   card (Visa, MC), apple_pay, vipps, swish
 */
// ── initiatePayment ───────────────────────────────────────────────────────────

const initiatePaymentSchema = z.object({
  orderId:   z.string().min(1),
  method:    z.enum(['card', 'apple_pay', 'stc_pay', 'mada', 'cash', 'vipps', 'swish']),
  returnUrl: z.string().url().optional(),
})

export const initiatePayment = callable(async (data, context) => {
  const { uid } = requireAuth(context, ['customer'])
  const input = validate(initiatePaymentSchema, data)
  await rateLimit(uid, 'payment')

  const orderDoc = await db.collection('orders').doc(input.orderId).get()
  if (!orderDoc.exists) appError('ORD_001', 'Order not found', 'not-found')

  const order = orderDoc.data() as Order
  if (order.customerId !== uid) {
    appError('AUTH_002', 'You do not own this order', 'permission-denied')
  }
  if (order.status !== 'confirmed') {
    appError('ORD_002', 'Order must be confirmed before payment')
  }
  // Allow retry if a previous payment attempt failed (C3)
  if (!['unpaid', 'failed'].includes(order.paymentStatus ?? '')) {
    appError('PAY_001', 'Payment already initiated for this order')
  }

  // Validate method is available for this currency/country
  const currency = order.currency ?? 'SAR'
  const scandinavianCurrencies = ['NOK', 'SEK']
  if (input.method === 'stc_pay' && scandinavianCurrencies.includes(currency)) {
    appError('VAL_001', 'STC Pay is not available in this country')
  }
  if (input.method === 'vipps' && currency !== 'NOK') {
    appError('VAL_001', 'Vipps is only available in Norway (NOK)')
  }
  if (input.method === 'swish' && currency !== 'SEK') {
    appError('VAL_001', 'Swish is only available in Sweden (SEK)')
  }

  // Cash payment — skip Tap, mark directly
  if (input.method === 'cash') {
    await db.collection('orders').doc(input.orderId).update({
      paymentMethod: 'cash',
      paymentStatus: 'held',
      updatedAt: serverTimestamp(),
    })
    return { ok: true, method: 'cash' }
  }

  // Tap Payments amounts are in the smallest unit:
  //   SAR/AED/QAR/etc → halalas (×100)
  //   KWD/BHD         → fils (×1000)
  //   NOK/SEK         → øre/öre (×100)
  const minorUnitMultipliers: Record<string, number> = {
    KWD: 1000, BHD: 1000,
  }
  const multiplier = minorUnitMultipliers[currency] ?? 100
  const amountMinor = Math.round((order.finalPrice ?? order.quotedPrice ?? 0) * multiplier)

  const tapSource = toTapSource(input.method, currency)

  // Create Tap charge with auto_capture: false = Escrow hold
  const tapCharge = await tapRequest('POST', '/charges', {
    amount:       amountMinor,
    currency,
    customer_initiated: true,
    auto_capture: false,           // ← Escrow: hold, capture after completion
    save_card:    false,
    description:  `WorkFix Order ${input.orderId}`,
    metadata: {
      order_id:    input.orderId,
      customer_id: uid,
      provider_id: order.providerId,
    },
    source: tapSource,
    redirect: {
      url: input.returnUrl ?? `https://workfix.app/payment/callback`,
    },
    post: {
      url: `https://me-central1-${process.env['FIREBASE_PROJECT_ID']}.cloudfunctions.net/tapWebhook`,
    },
  })

  // Store pending payment
  const paymentRef = db.collection('payments').doc()
  const payment: Omit<Payment, 'id'> = {
    orderId:    input.orderId,
    customerId: uid,
    providerId: order.providerId ?? '',
    moyasarId:  String(tapCharge['id']),   // field reused — stores Tap charge ID
    amount:     order.finalPrice ?? order.quotedPrice ?? 0,
    commission: order.commissionAmount ?? 0,
    netAmount:  order.netAmount ?? 0,
    status:     'initiated',
    method:     input.method,
    currency:   currency as Currency,
    createdAt:  serverTimestamp() as unknown as Timestamp,
    updatedAt:  serverTimestamp() as unknown as Timestamp,
  }
  await paymentRef.set({ ...payment, id: paymentRef.id })

  await db.collection('orders').doc(input.orderId).update({
    paymentMethod:   input.method,
    escrowPaymentId: String(tapCharge['id']),
    status:          'payment_pending',  // state machine: confirmed → payment_pending
    updatedAt:       serverTimestamp(),
  })

  return {
    ok:           true,
    paymentId:    paymentRef.id,
    tapChargeId:  String(tapCharge['id']),
    redirectUrl:  (tapCharge['transaction'] as Record<string, unknown>)?.['url'] as string | undefined,
  }
})

// ── tapWebhook (onRequest) ────────────────────────────────────────────────────

export const tapWebhook = functions
  .region('me-central1')
  .https.onRequest(async (req, res) => {
    addSecurityHeaders(res)

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    // ── Verify HMAC-SHA256 signature ──────────────────────────────────────────
    const webhookSecret = process.env['TAP_WEBHOOK_SECRET']
    if (!webhookSecret) {
      functions.logger.error('TAP_WEBHOOK_SECRET not configured')
      res.status(500).send('Server misconfigured')
      return
    }

    const { parseTapWebhook } = await import('../_shared/webhooks')
    const { verified, body } = parseTapWebhook(req, webhookSecret)

    if (!verified) {
      logger.security('webhook_invalid_signature', { ip: req.ip })
      res.status(401).json({ error: 'Invalid signature' })
      return
    }

    const event = body as {
      id:        string
      status:    string
      created?:  number   // Unix seconds — Tap sends this field
      merchant?: { id?: string }
      metadata?: { order_id?: string }
    }

    if (!event.id || typeof event.id !== 'string') {
      logger.security('webhook_missing_event_id', { ip: req.ip })
      res.status(400).json({ error: 'Missing event id' })
      return
    }

    // ── Merchant/account binding validation ───────────────────────────────────
    const expectedMerchantId = process.env['TAP_MERCHANT_ID']
    if (expectedMerchantId) {
      const receivedMerchantId = event.merchant?.id
      if (!receivedMerchantId || receivedMerchantId !== expectedMerchantId) {
        logger.security('webhook_merchant_mismatch', {
          eventId:            event.id,
          receivedMerchantId: receivedMerchantId ?? 'missing',
          ip:                 req.ip,
        })
        res.status(401).json({ error: 'Merchant binding mismatch' })
        return
      }
    }

    // ── Timestamp validation: reject events outside ±5 minute window ──────────
    if (event.created) {
      const eventMs  = event.created * 1000
      const diffMs   = Math.abs(Date.now() - eventMs)
      const FIVE_MIN = 5 * 60 * 1000
      if (diffMs > FIVE_MIN) {
        logger.security('webhook_timestamp_out_of_tolerance', {
          eventId:         event.id,
          eventCreated:    event.created,
          diffMinutes:     Math.round(diffMs / 60000),
          ip:              req.ip,
        })
        res.status(400).json({ error: 'Webhook timestamp out of tolerance' })
        return
      }
    }

    // ── Replay protection ─────────────────────────────────────────────────────
    // Quick non-transactional pre-check for performance. The authoritative
    // claim happens inside each case's transaction (C1: dedup + state update
    // in one atomic commit so no state is ever lost on partial failure).
    const eventRef = db.collection('_webhookEvents').doc(event.id)
    const quickSnap = await eventRef.get()
    if (quickSnap.exists) {
      logger.security('webhook_replay_detected', { eventId: event.id, ip: req.ip })
      res.status(200).json({ received: true, duplicate: true })
      return
    }

    // Shared event claim payload
    const eventClaim = {
      id:         event.id,
      status:     event.status,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      ip:         req.ip ?? null,
      // TTL: auto-delete after 7 days via daily cleanup job.
      expiresAt:  new Date(Date.now() + 7 * 24 * 3600_000),
    }

    logger.info('webhook_processing', { eventId: event.id, status: event.status })

    try {
      switch (event.status) {
        case 'AUTHORIZED': {
          // Payment held (Escrow) — funds reserved, not yet captured
          const orderId = event.metadata?.order_id
          if (!orderId) break

          const orderRef = db.collection('orders').doc(orderId)
          await db.runTransaction(async tx => {
            const [claimSnap] = await Promise.all([tx.get(eventRef), tx.get(orderRef)])
            if (claimSnap.exists) return  // duplicate caught by concurrent request
            tx.set(eventRef, eventClaim)
            tx.update(orderRef, { paymentStatus: 'held', updatedAt: serverTimestamp() })
          })

          // Best-effort: update payment doc (derived data — order is source of truth)
          const pq = await db.collection('payments').where('moyasarId', '==', event.id).limit(1).get()
          if (!pq.empty) {
            await pq.docs[0]!.ref.update({ status: 'held', updatedAt: serverTimestamp() })
          }
          break
        }

        case 'CAPTURED': {
          const orderId = event.metadata?.order_id
          if (!orderId) break

          const orderRef = db.collection('orders').doc(orderId)

          // C1: dedup claim + order state update in ONE transaction.
          // If either fails, neither commits → no permanent payment loss.
          await db.runTransaction(async tx => {
            const [claimSnap, orderSnap] = await Promise.all([
              tx.get(eventRef),
              tx.get(orderRef),
            ])
            if (claimSnap.exists) return  // duplicate
            const orderData = orderSnap.data()

            tx.set(eventRef, eventClaim)

            // Idempotency: already captured → claim event but skip order update
            if (orderData?.['paymentStatus'] === 'captured') return

            tx.update(orderRef, {
              paymentStatus: 'captured',
              ...(['payment_pending', 'confirmed'].includes(orderData?.['status'] ?? '') && { status: 'in_progress' }),
              updatedAt: serverTimestamp(),
            })
          })

          // Best-effort payment doc update
          const pq = await db.collection('payments').where('moyasarId', '==', event.id).limit(1).get()
          if (!pq.empty) {
            await pq.docs[0]!.ref.update({
              status: 'captured', capturedAt: serverTimestamp(), updatedAt: serverTimestamp(),
            })
          }
          break
        }

        case 'DECLINED':
        case 'CANCELLED': {
          const orderId = event.metadata?.order_id

          // C4: reset order back to 'confirmed' so customer can retry payment.
          // C1: dedup claim + state reset in ONE transaction.
          await db.runTransaction(async tx => {
            const claimSnap = await tx.get(eventRef)
            if (claimSnap.exists) return  // duplicate
            tx.set(eventRef, eventClaim)

            if (orderId) {
              const orderRef = db.collection('orders').doc(orderId)
              const orderSnap = await tx.get(orderRef)
              const orderData = orderSnap.data()
              // Only reset if the order is still in a payment-attempt state
              if (['payment_pending', 'confirmed'].includes(orderData?.['status'] ?? '')) {
                tx.update(orderRef, {
                  status:        'confirmed',   // allow customer to retry
                  paymentStatus: 'failed',      // C3: initiatePayment allows 'failed'
                  updatedAt:     serverTimestamp(),
                })
              }
            }
          })

          // Best-effort payment doc update
          if (orderId) {
            const pq = await db.collection('payments').where('moyasarId', '==', event.id).limit(1).get()
            if (!pq.empty) {
              await pq.docs[0]!.ref.update({ status: 'failed', updatedAt: serverTimestamp() })
            }
          }
          break
        }
      }

      res.status(200).json({ received: true })
    } catch (err) {
      functions.logger.error('Tap webhook processing error', { err })
      res.status(500).send('Internal Server Error')
    }
  })

// ── requestPayout ─────────────────────────────────────────────────────────────

const requestPayoutSchema = z.object({
  amount: z.number().positive().optional(),
})

export const requestPayout = callable(async (data, context) => {
  const { uid } = requireAuth(context, ['provider'])
  await rateLimit(uid, 'payment')
  const input = validate(requestPayoutSchema, data)

  // C5: per-provider mutex prevents concurrent payout calls from both
  // reading the same balance and triggering double transfers.
  // The lock document is created inside a transaction so only one caller wins.
  const lockRef = db.collection('_payoutLocks').doc(uid)
  const payoutRef = db.collection('payouts').doc()

  await db.runTransaction(async tx => {
    const [lockSnap, profileSnap] = await Promise.all([
      tx.get(lockRef),
      tx.get(db.collection('providerProfiles').doc(uid)),
    ])

    if (lockSnap.exists) {
      appError('PAY_005', 'A payout is already being processed. Please wait a moment and try again.')
    }
    if (!profileSnap.data()?.['bankIban']) {
      appError('VAL_002', 'Please add your bank IBAN before requesting a payout')
    }

    // Acquire mutex before balance check + Tap call
    tx.set(lockRef, {
      locked:   true,
      lockedAt: admin.firestore.FieldValue.serverTimestamp(),
      uid,
    })
  })

  try {
    // Balance: sum all captured payments minus all non-failed payouts
    const [capturedSnap, payoutsSnap, profileSnap] = await Promise.all([
      db.collection('payments').where('providerId', '==', uid).where('status', '==', 'captured').get(),
      db.collection('payouts').where('providerId', '==', uid)
        .where('status', 'in', ['pending', 'processing', 'completed']).get(),
      db.collection('providerProfiles').doc(uid).get(),
    ])

    const totalEarned = capturedSnap.docs.reduce(
      (sum, doc) => sum + (doc.data() as Payment).netAmount, 0,
    )
    const totalPaidOut = payoutsSnap.docs.reduce(
      (sum, doc) => sum + (doc.data()['amount'] as number), 0,
    )
    const availableBalance = totalEarned - totalPaidOut

    const payoutAmount   = input.amount ?? availableBalance
    const payoutCurrency = (capturedSnap.docs[0]?.data()['currency'] as string | undefined) ?? 'SAR'

    if (payoutAmount > availableBalance) {
      appError('PAY_004', `Insufficient balance. Available: ${availableBalance}`)
    }
    if (payoutAmount < 10) {
      appError('VAL_003', 'Minimum payout amount is 10 (local currency)')
    }

    const iban = profileSnap.data()?.['bankIban'] as string | undefined
    if (!iban) {
      appError('VAL_002', 'Please add your bank IBAN before requesting a payout')
    }

    const transfer = await tapRequest('POST', '/transfers', {
      amount:      Math.round(payoutAmount * 100),
      currency:    payoutCurrency,
      description: `WorkFix payout for provider ${uid}`,
      destination: { iban },
    })

    await payoutRef.set({
      providerId:  uid,
      amount:      payoutAmount,
      currency:    payoutCurrency,
      tapId:       transfer['id'],
      status:      'processing',
      requestedAt: serverTimestamp(),
      updatedAt:   serverTimestamp(),
    })

    return { ok: true, payoutId: transfer['id'], amount: payoutAmount }
  } finally {
    // Always release the lock, even if an error was thrown
    await lockRef.delete().catch(() => { /* ignore cleanup errors */ })
  }
})

// ── getWalletBalance ──────────────────────────────────────────────────────────

export const getWalletBalance = callable(async (_data, context) => {
  const { uid } = requireAuth(context, ['provider'])

  const [capturedSnap, heldSnap, payoutsSnap] = await Promise.all([
    db.collection('payments').where('providerId', '==', uid).where('status', '==', 'captured').get(),
    db.collection('payments').where('providerId', '==', uid).where('status', '==', 'held').get(),
    db.collection('payouts').where('providerId', '==', uid)
      .where('status', 'in', ['pending', 'processing', 'completed']).get(),
  ])

  const totalEarned = capturedSnap.docs.reduce(
    (s, d) => s + (d.data() as Payment).netAmount, 0,
  )
  const pendingEarned = heldSnap.docs.reduce(
    (s, d) => s + (d.data() as Payment).netAmount, 0,
  )
  const totalPaidOut = payoutsSnap.docs.reduce(
    (s, d) => s + (d.data()['amount'] as number), 0,
  )

  return {
    ok:                 true,
    availableBalance:   Math.round((totalEarned - totalPaidOut) * 100) / 100,
    pendingBalance:     Math.round(pendingEarned * 100) / 100,
    processingPayouts:  Math.round(totalPaidOut * 100) / 100,
    currency:           'SAR',
  }
})
