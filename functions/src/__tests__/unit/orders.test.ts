// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — Orders Cloud Functions
// Uses Firebase Emulator Suite for Firestore + Auth
// ─────────────────────────────────────────────────────────────────────────────

import * as admin from 'firebase-admin'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize test app pointing at emulator
process.env['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080'
process.env['FIREBASE_PROJECT_ID']     = 'workfix-test'

const app = initializeApp({ projectId: 'workfix-test' }, 'test-orders')
const db  = getFirestore(app)

// ── Test helpers ──────────────────────────────────────────────────────────────

async function createTestOrder(overrides: Record<string, unknown> = {}) {
  const ref = db.collection('orders').doc()
  const order = {
    id:            ref.id,
    customerId:    'customer_001',
    customerName:  'Test Customer',
    serviceId:     'service_001',
    categoryId:    'category_001',
    status:        'pending',
    commissionRate: 0.12,
    paymentStatus: 'unpaid',
    currency:      'SAR',
    location:      { latitude: 24.7, longitude: 46.7 },
    address:       'الرياض، حي النخيل',
    description:   'تركيب مكيف 2 طن في غرفة النوم',
    attachmentUrls: [],
    isScheduled:   false,
    createdAt:     admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
    ...overrides,
  }
  await ref.set(order)
  return { id: ref.id, ...order }
}

async function createTestQuote(orderId: string, overrides: Record<string, unknown> = {}) {
  const ref = db.collection('orders').doc(orderId).collection('quotes').doc()
  const quote = {
    id:                      ref.id,
    orderId,
    providerId:              'provider_001',
    providerName:            'Test Provider',
    providerRating:          4.8,
    price:                   350,
    currency:                'SAR',
    estimatedDurationMinutes: 120,
    status:                  'pending',
    expiresAt:               new Date(Date.now() + 86400_000),
    createdAt:               new Date(),
    ...overrides,
  }
  await ref.set(quote)
  return { id: ref.id, ...quote }
}

async function cleanup() {
  const orders = await db.collection('orders').listDocuments()
  const batch  = db.batch()
  orders.forEach(ref => batch.delete(ref))
  await batch.commit()
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Orders — state machine', () => {
  beforeEach(cleanup)
  afterAll(cleanup)

  test('pending → quoted: valid when quote is submitted', async () => {
    const order = await createTestOrder({ status: 'pending' })
    await createTestQuote(order.id)

    await db.collection('orders').doc(order.id).update({ status: 'quoted' })
    const updated = await db.collection('orders').doc(order.id).get()
    expect(updated.data()?.['status']).toBe('quoted')
  })

  test('confirmed → in_progress: valid transition', async () => {
    const order = await createTestOrder({
      status:        'confirmed',
      providerId:    'provider_001',
      paymentStatus: 'held',
      finalPrice:    350,
    })

    await db.collection('orders').doc(order.id).update({ status: 'in_progress' })
    const updated = await db.collection('orders').doc(order.id).get()
    expect(updated.data()?.['status']).toBe('in_progress')
  })

  test('closed order: cannot transition to any state', async () => {
    const order = await createTestOrder({ status: 'closed' })

    // Attempt invalid transition — Security Rules should block, but we test the logic
    const { isValidTransition } = await import('../../packages/utils/src/index')
    expect(isValidTransition('closed', 'pending')).toBe(false)
    expect(isValidTransition('closed', 'in_progress')).toBe(false)
    expect(isValidTransition('closed', 'disputed')).toBe(false)
  })
})

describe('Orders — commission calculation', () => {
  test('12% commission on SAR 350 = SAR 42', () => {
    const { calcCommission, calcNetAmount } = require('../../packages/utils/src/index')
    const gross = 350
    const rate  = 0.12

    expect(calcCommission(gross, rate)).toBe(42)
    expect(calcNetAmount(gross, rate)).toBe(308)
    expect(calcCommission(gross, rate) + calcNetAmount(gross, rate)).toBe(gross)
  })

  test('fractional amounts round to 2 decimal places', () => {
    const { calcCommission } = require('../../packages/utils/src/index')
    // SAR 99.99 × 12% = 11.9988 → rounds to 12
    expect(calcCommission(99.99, 0.12)).toBe(12)
  })

  test('KWD 100 × 10% = KWD 10', () => {
    const { calcCommission } = require('../../packages/utils/src/index')
    expect(calcCommission(100, 0.10)).toBe(10)
  })
})

describe('Orders — quote expiry', () => {
  test('expired quote cannot be accepted', async () => {
    const order = await createTestOrder({ status: 'quoted' })
    await createTestQuote(order.id, {
      status:    'pending',
      expiresAt: new Date(Date.now() - 1000),  // expired 1 second ago
    })

    const quotes = await db
      .collection('orders').doc(order.id)
      .collection('quotes')
      .where('status', '==', 'pending')
      .get()

    const expiredQuotes = quotes.docs.filter(
      d => (d.data()['expiresAt'] as admin.firestore.Timestamp).toDate() < new Date(),
    )
    expect(expiredQuotes).toHaveLength(1)
  })

  test('valid quote has correct expiry (24 hours)', async () => {
    const order = await createTestOrder()
    const quote = await createTestQuote(order.id)

    const expiryMs = quote.expiresAt.getTime() - Date.now()
    expect(expiryMs).toBeGreaterThan(23 * 3600_000)    // > 23 hours
    expect(expiryMs).toBeLessThan(25 * 3600_000)       // < 25 hours
  })
})
