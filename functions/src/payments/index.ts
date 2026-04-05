// ─────────────────────────────────────────────────────────────────────────────
// Payments Functions
// Gateway: Tap Payments — supports MENA (SAR/AED/KWD...) + Scandinavia (NOK/SEK)
//          + Vipps (Norway) + Swish (Sweden) + Apple Pay + Cards everywhere
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions'
import { z } from 'zod'
import {
  callable, requireAuth, validate, db,
  serverTimestamp, appError, increment,
} from '../_shared/helpers'
import { rateLimit } from '../_shared/ratelimit'
import type { Order, Payment } from '@workfix/types'
import { tapRequest, toTapSource } from '../_shared/tapClient'

// ── Tap Payments API client ───────────────────────────────────────────────────

const TAP_BASE = 'https://api.tap.company/v2'

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
  if (order.paymentStatus !== 'unpaid') {
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
    currency:   currency as import('@workfix/types').Currency,
    createdAt:  serverTimestamp() as unknown as import('@workfix/types').Timestamp,
    updatedAt:  serverTimestamp() as unknown as import('@workfix/types').Timestamp,
  }
  await paymentRef.set({ ...payment, id: paymentRef.id })

  await db.collection('orders').doc(input.orderId).update({
    paymentMethod:   input.method,
    escrowPaymentId: String(tapCharge['id']),
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
      res.status(401).json({ error: 'Invalid signature' })
      return
    }

    const event = body as {
      id:       string
      status:   string
      metadata?: { order_id?: string }
    }

    functions.logger.info('Tap webhook received', { id: event.id, status: event.status })

    try {
      switch (event.status) {
        case 'AUTHORIZED': {
          // Payment held (Escrow) — funds reserved, not yet captured
          const orderId = event.metadata?.order_id
          if (!orderId) break

          await db.runTransaction(async tx => {
            const orderRef = db.collection('orders').doc(orderId)
            const paymentQuery = await db.collection('payments')
              .where('moyasarId', '==', event.id)  // field stores Tap charge ID
              .limit(1).get()

            if (!paymentQuery.empty) {
              tx.update(paymentQuery.docs[0]!.ref, {
                status: 'held', updatedAt: serverTimestamp(),
              })
            }
            tx.update(orderRef, {
              paymentStatus: 'held', updatedAt: serverTimestamp(),
            })
          })
          break
        }

        case 'CAPTURED': {
          const orderId = event.metadata?.order_id
          if (!orderId) break

          const pq = await db.collection('payments')
            .where('moyasarId', '==', event.id).limit(1).get()

          if (!pq.empty) {
            await pq.docs[0]!.ref.update({
              status: 'captured', capturedAt: serverTimestamp(), updatedAt: serverTimestamp(),
            })
          }
          await db.collection('orders').doc(orderId).update({
            paymentStatus: 'captured', updatedAt: serverTimestamp(),
          })
          break
        }

        case 'DECLINED':
        case 'CANCELLED': {
          const pq = await db.collection('payments')
            .where('moyasarId', '==', event.id).limit(1).get()

          if (!pq.empty) {
            await pq.docs[0]!.ref.update({
              status: 'failed', updatedAt: serverTimestamp(),
            })
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
  const input = validate(requestPayoutSchema, data)

  const completedPayments = await db.collection('payments')
    .where('providerId', '==', uid)
    .where('status', '==', 'captured')
    .get()

  const totalBalance = completedPayments.docs.reduce(
    (sum, doc) => sum + (doc.data() as Payment).netAmount, 0,
  )

  const payoutAmount = input.amount ?? totalBalance
  if (payoutAmount > totalBalance) {
    appError('PAY_004', `Insufficient balance. Available: ${totalBalance}`)
  }
  if (payoutAmount < 10) {
    appError('VAL_003', 'Minimum payout amount is 10 (local currency)')
  }

  // Get provider's IBAN
  const profileDoc = await db.collection('providerProfiles').doc(uid).get()
  const iban = profileDoc.data()?.['bankIban'] as string | undefined
  if (!iban) {
    appError('VAL_002', 'Please add your bank IBAN before requesting a payout')
  }

  // Tap Transfer (works for MENA + SEPA for NO/SE)
  const apiKey = process.env['TAP_SECRET_KEY']
  if (!apiKey) throw new Error('TAP_SECRET_KEY missing')

  const transfer = await tapRequest('POST', '/transfers', {
    amount:      Math.round(payoutAmount * 100),
    currency:    completedPayments.docs[0]?.data()['currency'] ?? 'SAR',
    description: `WorkFix payout for provider ${uid}`,
    destination: { iban },
  })

  await db.collection('payouts').add({
    providerId:  uid,
    amount:      payoutAmount,
    tapId:       transfer['id'],
    status:      'processing',
    requestedAt: serverTimestamp(),
    updatedAt:   serverTimestamp(),
  })

  return { ok: true, payoutId: transfer['id'], amount: payoutAmount }
})

// ── getWalletBalance ──────────────────────────────────────────────────────────

export const getWalletBalance = callable(async (_data, context) => {
  const { uid } = requireAuth(context, ['provider'])

  const [capturedSnap, heldSnap, payoutsSnap] = await Promise.all([
    db.collection('payments').where('providerId', '==', uid).where('status', '==', 'captured').get(),
    db.collection('payments').where('providerId', '==', uid).where('status', '==', 'held').get(),
    db.collection('payouts').where('providerId', '==', uid).where('status', '==', 'processing').get(),
  ])

  const totalEarned = capturedSnap.docs.reduce(
    (s, d) => s + (d.data() as Payment).netAmount, 0,
  )
  const pendingEarned = heldSnap.docs.reduce(
    (s, d) => s + (d.data() as Payment).netAmount, 0,
  )
  const processingPayouts = payoutsSnap.docs.reduce(
    (s, d) => s + (d.data()['amount'] as number), 0,
  )

  return {
    ok:                 true,
    availableBalance:   Math.round((totalEarned - processingPayouts) * 100) / 100,
    pendingBalance:     Math.round(pendingEarned * 100) / 100,
    processingPayouts:  Math.round(processingPayouts * 100) / 100,
    currency:           'SAR',
  }
})
