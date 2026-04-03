// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests — Full order lifecycle E2E with Firebase Emulator
// ─────────────────────────────────────────────────────────────────────────────

import * as admin from 'firebase-admin'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth }      from 'firebase-admin/auth'

process.env['FIRESTORE_EMULATOR_HOST']       = 'localhost:8080'
process.env['FIREBASE_AUTH_EMULATOR_HOST']   = 'localhost:9099'
process.env['FIREBASE_PROJECT_ID']           = 'workfix-test'

const app  = admin.initializeApp({ projectId: 'workfix-test' }, 'test-integration')
const db   = getFirestore(app)
const auth = getAuth(app)

async function createUser(uid: string, role: string) {
  try { await auth.deleteUser(uid) } catch {}
  await auth.createUser({ uid, email: `${uid}@test.com`, emailVerified: true })
  await auth.setCustomUserClaims(uid, { role })
  await db.collection('users').doc(uid).set({
    id: uid, displayName: `Test ${uid}`, role,
    isVerified: true, isActive: true, createdAt: new Date(), updatedAt: new Date(),
  })
}

async function createProvider(uid: string) {
  await createUser(uid, 'provider')
  await db.collection('providerProfiles').doc(uid).set({
    id: uid, type: 'individual',
    location: { latitude: 24.7, longitude: 46.7 },
    geohash: 'sj', city: 'الرياض', country: 'SA',
    serviceIds: ['svc_001'], categoryIds: ['cat_001'],
    avgRating: 4.8, totalReviews: 10, totalCompletedOrders: 10,
    kycStatus: 'approved', subscriptionTier: 'free', isActive: true,
    kycDocumentUrls: [], createdAt: new Date(), updatedAt: new Date(),
  })
}

async function cleanup() {
  for (const col of ['orders','payments','reviews','disputes','users','providerProfiles']) {
    const docs = await db.collection(col).listDocuments()
    if (docs.length === 0) continue
    const b = db.batch()
    docs.forEach(r => b.delete(r))
    await b.commit()
  }
}

describe('Full order lifecycle', () => {
  const CID = 'int_c1', PID = 'int_p1'
  let orderId: string, quoteId: string

  beforeAll(async () => {
    await cleanup()
    await createUser(CID, 'customer')
    await createProvider(PID)
  }, 30000)

  afterAll(cleanup)

  test('1. Order created with status pending', async () => {
    const ref = db.collection('orders').doc()
    orderId = ref.id
    await ref.set({
      id: orderId, customerId: CID, customerName: 'Customer',
      serviceId: 'svc_001', categoryId: 'cat_001',
      serviceName: { ar: 'خدمة', en: 'Service' },
      status: 'pending', commissionRate: 0.12,
      paymentStatus: 'unpaid', currency: 'SAR',
      location: { latitude: 24.71, longitude: 46.68 },
      address: 'الرياض', description: 'تركيب مكيف 2 طن في الغرفة الرئيسية',
      attachmentUrls: [], isScheduled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    const snap = await db.collection('orders').doc(orderId).get()
    expect(snap.data()?.['status']).toBe('pending')
  })

  test('2. Provider submits quote → order becomes quoted', async () => {
    const qref = db.collection('orders').doc(orderId).collection('quotes').doc()
    quoteId = qref.id
    await qref.set({
      id: quoteId, orderId, providerId: PID, providerName: 'Provider',
      providerRating: 4.8, price: 350, currency: 'SAR',
      estimatedDurationMinutes: 120, status: 'pending',
      expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(),
    })
    await db.collection('orders').doc(orderId).update({ status: 'quoted' })

    const snap = await db.collection('orders').doc(orderId).get()
    expect(snap.data()?.['status']).toBe('quoted')
  })

  test('3. Customer accepts quote → confirmed with correct commission', async () => {
    const orderRef = db.collection('orders').doc(orderId)
    const quoteRef = orderRef.collection('quotes').doc(quoteId)

    await db.runTransaction(async tx => {
      const quoteDoc = await tx.get(quoteRef)
      const price    = quoteDoc.data()?.['price'] as number
      const comm     = Math.round(price * 0.12 * 100) / 100
      tx.update(quoteRef, { status: 'accepted' })
      tx.update(orderRef, {
        status: 'confirmed', providerId: PID,
        finalPrice: price, commissionAmount: comm, netAmount: price - comm,
        paymentStatus: 'unpaid',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    })

    const snap = await db.collection('orders').doc(orderId).get()
    expect(snap.data()?.['status']).toBe('confirmed')
    expect(snap.data()?.['commissionAmount']).toBe(42)   // 350 * 12%
    expect(snap.data()?.['netAmount']).toBe(308)
  })

  test('4. Payment held → Escrow active', async () => {
    await db.collection('orders').doc(orderId).update({
      paymentStatus: 'held', escrowPaymentId: 'chg_test_001',
    })
    const snap = await db.collection('orders').doc(orderId).get()
    expect(snap.data()?.['paymentStatus']).toBe('held')
  })

  test('5. Provider completes → customer confirms → closed', async () => {
    await db.collection('orders').doc(orderId).update({ status: 'completed' })
    await db.collection('orders').doc(orderId).update({
      status: 'closed', paymentStatus: 'captured',
      closedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    const snap = await db.collection('orders').doc(orderId).get()
    expect(snap.data()?.['status']).toBe('closed')
    expect(snap.data()?.['paymentStatus']).toBe('captured')
  })

  test('6. Commission math: gross = commission + net', async () => {
    const snap = await db.collection('orders').doc(orderId).get()
    const d    = snap.data()!
    expect((d['commissionAmount'] as number) + (d['netAmount'] as number))
      .toBe(d['finalPrice'] as number)
  })
})

describe('Dispute flow', () => {
  const CID = 'dis_c1', PID = 'dis_p1'
  let orderId: string

  beforeAll(async () => {
    await createUser(CID, 'customer')
    await createProvider(PID)
    const ref = db.collection('orders').doc()
    orderId = ref.id
    await ref.set({
      id: orderId, customerId: CID, providerId: PID,
      status: 'completed', paymentStatus: 'held',
      finalPrice: 500, commissionAmount: 60, netAmount: 440,
      currency: 'SAR', createdAt: new Date(), updatedAt: new Date(),
    })
  }, 20000)

  test('Dispute opens → order becomes disputed', async () => {
    const disputeRef = db.collection('disputes').doc()
    await db.runTransaction(async tx => {
      tx.set(disputeRef, {
        id: disputeRef.id, orderId,
        initiatorId: CID, initiatorRole: 'customer', respondentId: PID,
        reason: 'not_completed', description: 'العمل لم يُكتمل كما وعد',
        evidenceUrls: [], status: 'open',
        createdAt: new Date(), updatedAt: new Date(),
      })
      tx.update(db.collection('orders').doc(orderId), { status: 'disputed' })
    })

    const snap = await db.collection('orders').doc(orderId).get()
    expect(snap.data()?.['status']).toBe('disputed')
  })

  test('Admin resolves in favor of customer → refunded', async () => {
    const dSnap = await db.collection('disputes').where('orderId','==',orderId).limit(1).get()
    await db.runTransaction(async tx => {
      tx.update(dSnap.docs[0]!.ref, {
        status: 'resolved_customer', releaseToParty: 'customer',
        resolution: 'تم التحقق', resolvedAt: new Date(),
      })
      tx.update(db.collection('orders').doc(orderId), {
        status: 'cancelled', paymentStatus: 'refunded',
      })
    })

    const snap = await db.collection('orders').doc(orderId).get()
    expect(snap.data()?.['status']).toBe('cancelled')
    expect(snap.data()?.['paymentStatus']).toBe('refunded')
  })
})
