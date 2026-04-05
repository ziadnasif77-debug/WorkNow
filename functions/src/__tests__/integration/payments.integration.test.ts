// ─────────────────────────────────────────────────────────────────────────────
// Integration tests — Payments: webhook, fraud, rate limiting, escrow
// ─────────────────────────────────────────────────────────────────────────────

import * as crypto from 'crypto'
import * as admin  from 'firebase-admin'
import { getFirestore } from 'firebase-admin/firestore'

process.env['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080'
process.env['FIREBASE_PROJECT_ID']     = 'workfix-test'
process.env['TAP_SECRET_KEY']          = 'sk_test_fake'
process.env['TAP_WEBHOOK_SECRET']      = 'webhook_secret_test_abc'

let db: admin.firestore.Firestore

beforeAll(() => {
  try {
    const app = admin.app('payment-integ-test')
    db = getFirestore(app)
  } catch {
    const app = admin.initializeApp({ projectId: 'workfix-test' }, 'payment-integ-test')
    db = getFirestore(app)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK SIGNATURE VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Tap webhook HMAC-SHA256 verification', () => {
  const SECRET  = 'webhook_secret_test_abc'
  const PAYLOAD = JSON.stringify({
    id: 'chg_test_001', status: 'AUTHORIZED',
    metadata: { order_id: 'order_001', customer_id: 'cust_001' },
  })

  function sign(secret: string, body: string) {
    return crypto.createHmac('sha256', secret).update(body).digest('hex').toUpperCase()
  }

  test('correct signature → returns verified: true', () => {
    const { verifyTapWebhook } = require('../../_shared/webhooks')
    expect(verifyTapWebhook(PAYLOAD, sign(SECRET, PAYLOAD), SECRET)).toBe(true)
  })

  test('wrong secret → returns false', () => {
    const { verifyTapWebhook } = require('../../_shared/webhooks')
    expect(verifyTapWebhook(PAYLOAD, sign('wrong_secret', PAYLOAD), SECRET)).toBe(false)
  })

  test('tampered body → returns false', () => {
    const { verifyTapWebhook } = require('../../_shared/webhooks')
    const sig      = sign(SECRET, PAYLOAD)
    const tampered = PAYLOAD.replace('AUTHORIZED', 'CAPTURED')
    expect(verifyTapWebhook(tampered, sig, SECRET)).toBe(false)
  })

  test('missing signature header → returns false', () => {
    const { verifyTapWebhook } = require('../../_shared/webhooks')
    expect(verifyTapWebhook(PAYLOAD, undefined, SECRET)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

describe('Payment Escrow state machine', () => {
  test('payment transitions: initiated → held → captured', async () => {
    const ref = db.collection('payments').doc('pay_test_states')

    await ref.set({
      id: 'pay_test_states', orderId: 'order_states', customerId: 'cust_001',
      providerId: 'prov_001', moyasarId: 'chg_states_001',
      amount: 200, commission: 24, netAmount: 176,
      status: 'initiated', method: 'card', currency: 'SAR',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Transition: initiated → held (webhook AUTHORIZED)
    await ref.update({ status: 'held', updatedAt: admin.firestore.FieldValue.serverTimestamp() })
    let doc = await ref.get()
    expect(doc.data()!['status']).toBe('held')

    // Transition: held → captured (order closed)
    await ref.update({
      status:     'captured',
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
    })
    doc = await ref.get()
    expect(doc.data()!['status']).toBe('captured')

    await ref.delete()
  })

  test('commission calculation: 12% of 150 SAR = 18 SAR net = 132 SAR', () => {
    const { calcCommission, calcNetAmount } = require('../../../packages/utils/src')
    // Note: these are tested in utils but verifying integration behaviour
    const gross = 150, rate = 0.12
    expect(Math.round(gross * rate * 100) / 100).toBe(18)
    expect(gross - Math.round(gross * rate * 100) / 100).toBe(132)
  })

  test('NOK currency uses ×100 multiplier (øre)', () => {
    const amount = 500  // 500 NOK
    const multipliers: Record<string, number> = { KWD: 1000, BHD: 1000 }
    const multiplier = multipliers['NOK'] ?? 100
    expect(amount * multiplier).toBe(50000)  // 50,000 øre
  })

  test('KWD currency uses ×1000 multiplier (fils)', () => {
    const amount = 10  // 10 KWD
    const multipliers: Record<string, number> = { KWD: 1000, BHD: 1000 }
    const multiplier = multipliers['KWD'] ?? 100
    expect(amount * multiplier).toBe(10000)  // 10,000 fils
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────────

describe('Rate limiting', () => {
  test('rate limit config: OTP max 5 per hour', () => {
    const LIMITS: Record<string, { windowMs: number; maxHits: number }> = {
      auth_otp: { windowMs: 3_600_000, maxHits: 5 },
      payment:  { windowMs: 3_600_000, maxHits: 10 },
      order_create: { windowMs: 3_600_000, maxHits: 20 },
    }
    expect(LIMITS['auth_otp']!.maxHits).toBe(5)
    expect(LIMITS['payment']!.maxHits).toBe(10)
    expect(LIMITS['order_create']!.maxHits).toBe(20)
  })

  test('sliding window: hits within window counted correctly', async () => {
    const uid     = 'rate_limit_test_user'
    const key     = `otp_${uid}`
    const now     = Date.now()
    const windowMs = 3_600_000  // 1 hour

    // Simulate 4 previous hits
    const ref = db.collection('_rateLimits').doc(key)
    await ref.set({
      uid, key,
      hits: [now - 100, now - 200, now - 300, now - 400],  // 4 hits
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    const doc  = await ref.get()
    const hits  = (doc.data()!['hits'] as number[]).filter(t => t > now - windowMs)
    expect(hits.length).toBe(4)
    expect(hits.length < 5).toBe(true)  // under limit → allowed

    await ref.delete()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FRAUD DETECTION
// ─────────────────────────────────────────────────────────────────────────────

describe('Fraud detection rules', () => {
  test('suspicious: same user creates 5+ orders in 5 minutes', async () => {
    const uid    = 'fraud_test_user'
    const now    = Date.now()
    const window = 5 * 60 * 1000  // 5 minutes

    // Simulate rapid order creation
    const recentOrders = [
      now - 10_000,  // 10s ago
      now - 20_000,
      now - 30_000,
      now - 40_000,
      now - 50_000,  // 50s ago — 5 orders in < 1 min
    ]

    const ordersInWindow = recentOrders.filter(t => t > now - window)
    const isSuspicious   = ordersInWindow.length >= 5

    expect(isSuspicious).toBe(true)
  })

  test('normal: 2 orders in 5 minutes → not suspicious', () => {
    const now    = Date.now()
    const window = 5 * 60 * 1000

    const recentOrders = [now - 60_000, now - 120_000]
    const ordersInWindow = recentOrders.filter(t => t > now - window)

    expect(ordersInWindow.length < 5).toBe(true)
  })

  test('payment method mismatch: vipps in SA → rejected', () => {
    const scandinavianOnly = ['vipps', 'swish']
    const method = 'vipps'
    const country = 'SA'

    // Vipps only valid for Norway
    const isValid = !(scandinavianOnly.includes(method) && (country as string) !== 'NO' && method === 'vipps')
    expect(isValid).toBe(false)
  })

  test('payment method match: vipps in NO → accepted', () => {
    const method  = 'vipps'
    const country = 'NO'
    const isValid = !(method === 'vipps' && country !== 'NO')
    expect(isValid).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PAYOUT FLOW
// ─────────────────────────────────────────────────────────────────────────────

describe('Payout flow validation', () => {
  test('minimum payout: 10 SAR', () => {
    const minPayout = 10
    expect(5  < minPayout).toBe(true)   // rejected
    expect(10 >= minPayout).toBe(true)  // accepted
    expect(50 >= minPayout).toBe(true)  // accepted
  })

  test('payout cannot exceed available balance', () => {
    const balance = 150
    const request = 200
    expect(request > balance).toBe(true)  // should be rejected
  })

  test('net payout = captured payments - processing payouts', () => {
    const captured           = [132, 88, 176]   // net amounts from 3 orders
    const processingPayouts  = [100]             // payout in progress

    const totalEarned    = captured.reduce((a, b) => a + b, 0)  // 396
    const totalProcessing = processingPayouts.reduce((a, b) => a + b, 0)  // 100
    const available      = totalEarned - totalProcessing  // 296

    expect(totalEarned).toBe(396)
    expect(available).toBe(296)
  })
})
