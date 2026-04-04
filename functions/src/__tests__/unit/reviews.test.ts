// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — Reviews & Disputes Cloud Functions
// submitReview + openDispute
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. firebase-functions mock ────────────────────────────────────────────────
class MockHttpsError extends Error {
  code: string; details: unknown
  constructor(code: string, msg: string, details?: unknown) {
    super(msg); this.name = 'HttpsError'; this.code = code; this.details = details
  }
}
const mockOnCall    = jest.fn((fn: unknown) => fn)
const mockHttps     = { HttpsError: MockHttpsError, onCall: mockOnCall }
const mockLogger    = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), security: jest.fn() }

jest.mock('firebase-functions', () => ({
  https:  mockHttps,
  region: jest.fn(() => ({ https: mockHttps })),
  logger: mockLogger,
}))

// ── 2. firebase-admin mock ────────────────────────────────────────────────────
const mockBatchCommit  = jest.fn(() => Promise.resolve())
const mockBatchUpdate  = jest.fn()
const mockBatchSet     = jest.fn()
const mockBatch        = jest.fn(() => ({
  update: mockBatchUpdate,
  set:    mockBatchSet,
  commit: mockBatchCommit,
}))

const mockUpdate = jest.fn(() => Promise.resolve())
const mockSet    = jest.fn(() => Promise.resolve())
const mockAdd    = jest.fn(() => Promise.resolve({ id: 'review_new_001' }))
const mockGet    = jest.fn()

const mockRunTransaction = jest.fn(
  async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) => {
    // Simulate empty rate-limit window (0 hits — under limit)
    const txGet = jest.fn().mockResolvedValue({ data: () => ({ hits: [] }) })
    return fn({ get: txGet, set: jest.fn(), update: jest.fn() })
  }
)

// Per-collection mock dispatch
const collectionMocks = new Map<string, () => unknown>()

const mockFirestore = jest.fn(() => ({
  collection:     jest.fn((name: string) => {
    const factory = collectionMocks.get(name)
    return factory ? factory() : makeEmptyChain()
  }),
  batch:          mockBatch,
  runTransaction: mockRunTransaction,
}))

Object.assign(mockFirestore, {
  FieldValue: {
    serverTimestamp: jest.fn(() => '__ts__'),
    increment:       jest.fn((n: number) => n),
    arrayUnion:      jest.fn((...a: unknown[]) => a),
  },
  Timestamp: {
    fromDate: jest.fn((d: Date) => ({ toDate: () => d })),
    now:      jest.fn(() => ({ toDate: () => new Date() })),
  },
})

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore:     mockFirestore,
  auth:          jest.fn(() => ({})),
  storage:       jest.fn(() => ({})),
  messaging:     jest.fn(() => ({})),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEmptySnap(docs: unknown[] = []) {
  return { empty: docs.length === 0, size: docs.length, docs }
}

function makeDocSnap(
  id: string,
  data: Record<string, unknown>,
  exists = true,
) {
  return {
    id, exists,
    ref: { update: mockUpdate, id },
    data: () => data,
  }
}

function makeChain(snap: unknown) {
  const getMock = jest.fn().mockResolvedValue(snap)
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain['where']   = jest.fn(self)
  chain['limit']   = jest.fn(self)
  chain['orderBy'] = jest.fn(self)
  chain['get']     = getMock
  chain['update']  = mockUpdate
  chain['set']     = mockSet
  chain['add']     = mockAdd
  chain['doc']     = jest.fn((id?: string) => {
    const collSnap = snap as { docs?: Array<{ id: string }> }
    const docSnap = collSnap?.docs?.find((d) => d.id === id)
    const docGetMock = jest.fn().mockResolvedValue(
      docSnap ?? makeDocSnap(id ?? 'doc_001', {}, false)
    )
    return {
      get:    docGetMock,
      update: mockUpdate,
      set:    mockSet,
      id:     id ?? 'doc_001',
      ref:    { update: mockUpdate, id: id ?? 'doc_001' },
      collection: jest.fn(() => makeChain(makeEmptySnap())),
    }
  })
  return chain as unknown as jest.Mock
}

function makeEmptyChain() { return makeChain(makeEmptySnap()) }

function makeCtx(uid = 'customer_001', role = 'customer') {
  return {
    auth: { uid, token: { role } },
    rawRequest: { ip: '127.0.0.1' },
  }
}

type Fn = (data: unknown, ctx: unknown) => Promise<Record<string, unknown>>

// ── Imports AFTER mocks ───────────────────────────────────────────────────────
import { submitReview, openDispute } from '../../reviews/index'

const callReview  = submitReview  as unknown as Fn
const callDispute = openDispute   as unknown as Fn

// ── Shared order fixtures ─────────────────────────────────────────────────────
const CLOSED_ORDER = makeDocSnap('ord_001', {
  id:          'ord_001',
  customerId:  'customer_001',
  providerId:  'provider_001',
  status:      'closed',
  currency:    'SAR',
})

const PENDING_ORDER = makeDocSnap('ord_002', {
  id:          'ord_002',
  customerId:  'customer_001',
  providerId:  'provider_001',
  status:      'pending',
  currency:    'SAR',
})

const IN_PROGRESS_ORDER = makeDocSnap('ord_003', {
  id:          'ord_003',
  customerId:  'customer_001',
  providerId:  'provider_001',
  status:      'in_progress',
  currency:    'SAR',
})

const PROVIDER_PROFILE = makeDocSnap('provider_001', {
  avgRating:    4.5,
  totalReviews: 10,
})

const USER_DOC = makeDocSnap('customer_001', {
  displayName: 'Ahmed',
  avatarUrl:   null,
})

// ══════════════════════════════════════════════════════════════════════════════
// §1  submitReview — auth & input validation
// ══════════════════════════════════════════════════════════════════════════════

describe('submitReview() — auth & validation', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws unauthenticated when auth is missing', async () => {
    await expect(
      callReview({ orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider', rating: 5 }, { auth: null })
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('throws invalid-argument for missing orderId', async () => {
    await expect(
      callReview({ orderId: '', targetId: 'provider_001', targetType: 'provider', rating: 5 }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument for rating < 1', async () => {
    await expect(
      callReview({ orderId: 'ord_001', targetId: 'p1', targetType: 'provider', rating: 0 }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument for rating > 5', async () => {
    await expect(
      callReview({ orderId: 'ord_001', targetId: 'p1', targetType: 'provider', rating: 6 }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument for non-integer rating', async () => {
    await expect(
      callReview({ orderId: 'ord_001', targetId: 'p1', targetType: 'provider', rating: 3.5 }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument for invalid targetType', async () => {
    await expect(
      callReview({ orderId: 'ord_001', targetId: 'p1', targetType: 'admin', rating: 4 }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument when comment exceeds 500 chars', async () => {
    await expect(
      callReview({
        orderId: 'ord_001', targetId: 'p1', targetType: 'provider',
        rating: 4, comment: 'x'.repeat(501),
      }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument when tags array exceeds 6 items', async () => {
    await expect(
      callReview({
        orderId: 'ord_001', targetId: 'p1', targetType: 'provider',
        rating: 4, tags: ['a','b','c','d','e','f','g'],
      }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §2  submitReview — business logic
// ══════════════════════════════════════════════════════════════════════════════

describe('submitReview() — business logic', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRunTransaction.mockImplementation(
      async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) => {
        const txGet = jest.fn().mockResolvedValue(PROVIDER_PROFILE)
        return fn({ get: txGet, set: jest.fn(), update: jest.fn() })
      }
    )
  })

  function setupReviewMocks(options: {
    order?: ReturnType<typeof makeDocSnap>
    existingReview?: boolean
  } = {}) {
    const order = options.order ?? CLOSED_ORDER
    const existingReview = options.existingReview ?? false

    collectionMocks.set('orders', () => makeChain(makeEmptySnap([order])))
    collectionMocks.set('reviews', () =>
      makeChain(makeEmptySnap(existingReview
        ? [makeDocSnap('rev_existing', { orderId: 'ord_001', reviewerId: 'customer_001' })]
        : []
      ))
    )
    collectionMocks.set('users', () => makeChain(makeEmptySnap([USER_DOC])))
    collectionMocks.set('providerProfiles', () => makeChain(makeEmptySnap([PROVIDER_PROFILE])))
    collectionMocks.set('_rateLimits', () => makeEmptyChain())
  }

  it('throws not-found when order does not exist', async () => {
    collectionMocks.set('orders', () =>
      makeChain(makeEmptySnap([makeDocSnap('ord_missing', {}, false)]))
    )
    collectionMocks.set('_rateLimits', () => makeEmptyChain())
    await expect(
      callReview({ orderId: 'ord_missing', targetId: 'p1', targetType: 'provider', rating: 4 }, makeCtx())
    ).rejects.toMatchObject({ code: 'not-found' })
  })

  it('throws permission-denied when reviewer is not a party', async () => {
    setupReviewMocks()
    // stranger is not customerId='customer_001' or providerId='provider_001'
    await expect(
      callReview(
        { orderId: 'ord_001', targetId: 'p1', targetType: 'provider', rating: 4 },
        makeCtx('stranger_999', 'customer')
      )
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('throws when order status is not closed/completed', async () => {
    setupReviewMocks({ order: PENDING_ORDER })
    await expect(
      callReview({ orderId: 'ord_002', targetId: 'provider_001', targetType: 'provider', rating: 4 }, makeCtx())
    ).rejects.toThrow()
  })

  it('throws when review already exists for this order+user', async () => {
    setupReviewMocks({ existingReview: true })
    await expect(
      callReview({ orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider', rating: 4 }, makeCtx())
    ).rejects.toThrow()
  })

  it('returns ok=true and a reviewId on success', async () => {
    setupReviewMocks()
    const result = await callReview({
      orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider',
      rating: 5, comment: 'Excellent service',
    }, makeCtx())
    expect(result['ok']).toBe(true)
    expect(result['reviewId']).toBeTruthy()
  })

  it('provider can also review a customer (targetType=customer)', async () => {
    collectionMocks.set('orders', () => makeChain(makeEmptySnap([CLOSED_ORDER])))
    collectionMocks.set('reviews', () => makeChain(makeEmptySnap()))
    collectionMocks.set('users', () => makeChain(makeEmptySnap([
      makeDocSnap('provider_001', { displayName: 'Mohammed', avatarUrl: null })
    ])))
    collectionMocks.set('providerProfiles', () => makeChain(makeEmptySnap()))
    collectionMocks.set('_rateLimits', () => makeEmptyChain())

    const result = await callReview({
      orderId: 'ord_001', targetId: 'customer_001', targetType: 'customer',
      rating: 4,
    }, makeCtx('provider_001', 'provider'))
    expect(result['ok']).toBe(true)
  })

  it('updates provider avgRating via transaction when targetType=provider', async () => {
    setupReviewMocks()
    let transactionCalled = false
    mockRunTransaction.mockImplementationOnce(
      async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) => {
        // Skip rate-limit tx (first call)
        const txGet = jest.fn().mockResolvedValue({ data: () => ({ hits: [] }) })
        return fn({ get: txGet, set: jest.fn(), update: jest.fn() })
      }
    ).mockImplementationOnce(
      async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) => {
        // Provider rating update tx
        transactionCalled = true
        const txUpdate = jest.fn()
        const txGet = jest.fn().mockResolvedValue(PROVIDER_PROFILE)
        return fn({ get: txGet, set: jest.fn(), update: txUpdate })
      }
    )
    await callReview({
      orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider', rating: 5,
    }, makeCtx())
    expect(transactionCalled).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §3  openDispute — auth & validation
// ══════════════════════════════════════════════════════════════════════════════

describe('openDispute() — auth & validation', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws unauthenticated when auth is missing', async () => {
    await expect(
      callDispute({ orderId: 'ord_001', reason: 'not_completed', description: 'x'.repeat(20) }, { auth: null })
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('throws invalid-argument for missing orderId', async () => {
    await expect(
      callDispute({ orderId: '', reason: 'fraud', description: 'y'.repeat(20) }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument when description < 20 chars', async () => {
    await expect(
      callDispute({ orderId: 'ord_001', reason: 'not_done', description: 'too short' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument when description > 1000 chars', async () => {
    await expect(
      callDispute({ orderId: 'ord_001', reason: 'fraud', description: 'x'.repeat(1001) }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument when evidenceUrls has more than 5 items', async () => {
    await expect(
      callDispute({
        orderId: 'ord_001', reason: 'fraud',
        description: 'x'.repeat(25),
        evidenceUrls: ['https://x.com/1','https://x.com/2','https://x.com/3',
                       'https://x.com/4','https://x.com/5','https://x.com/6'],
      }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §4  openDispute — business logic
// ══════════════════════════════════════════════════════════════════════════════

describe('openDispute() — business logic', () => {
  const VALID_DESCRIPTION = 'العمل لم يُكتمل كما اتفقنا عليه في البداية'  // > 20 chars

  beforeEach(() => {
    jest.clearAllMocks()
    mockRunTransaction.mockImplementation(
      async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) => {
        const txGet = jest.fn().mockResolvedValue({ data: () => ({ hits: [] }) })
        return fn({ get: txGet, set: jest.fn(), update: jest.fn() })
      }
    )
  })

  function setupDisputeMocks(options: {
    order?: ReturnType<typeof makeDocSnap>
    existingDispute?: boolean
  } = {}) {
    const order = options.order ?? IN_PROGRESS_ORDER
    collectionMocks.set('orders', () => makeChain(makeEmptySnap([order])))
    collectionMocks.set('disputes', () =>
      makeChain(makeEmptySnap(options.existingDispute
        ? [makeDocSnap('dis_existing', { orderId: 'ord_003', status: 'open' })]
        : []
      ))
    )
    collectionMocks.set('_rateLimits', () => makeEmptyChain())
  }

  it('throws not-found when order does not exist', async () => {
    collectionMocks.set('orders', () =>
      makeChain(makeEmptySnap([makeDocSnap('ord_missing', {}, false)]))
    )
    collectionMocks.set('_rateLimits', () => makeEmptyChain())
    await expect(
      callDispute({ orderId: 'ord_missing', reason: 'fraud', description: VALID_DESCRIPTION }, makeCtx())
    ).rejects.toMatchObject({ code: 'not-found' })
  })

  it('throws permission-denied when caller is not a party', async () => {
    setupDisputeMocks()
    await expect(
      callDispute(
        { orderId: 'ord_003', reason: 'fraud', description: VALID_DESCRIPTION },
        makeCtx('stranger_999', 'customer')
      )
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('throws for invalid order status (quoted)', async () => {
    setupDisputeMocks({
      order: makeDocSnap('ord_004', {
        customerId: 'customer_001', providerId: 'provider_001', status: 'quoted',
      }),
    })
    await expect(
      callDispute({ orderId: 'ord_004', reason: 'fraud', description: VALID_DESCRIPTION }, makeCtx())
    ).rejects.toThrow()
  })

  it('throws when an active dispute already exists for the order', async () => {
    setupDisputeMocks({ existingDispute: true })
    await expect(
      callDispute({ orderId: 'ord_003', reason: 'not_completed', description: VALID_DESCRIPTION }, makeCtx())
    ).rejects.toThrow()
  })

  it('returns ok=true and disputeId on success (customer initiates)', async () => {
    setupDisputeMocks()
    const result = await callDispute({
      orderId: 'ord_003', reason: 'not_completed',
      description: VALID_DESCRIPTION,
    }, makeCtx('customer_001', 'customer'))
    expect(result['ok']).toBe(true)
    expect(result['disputeId']).toBeTruthy()
  })

  it('returns ok=true when provider initiates dispute', async () => {
    setupDisputeMocks()
    const result = await callDispute({
      orderId: 'ord_003', reason: 'payment_issue',
      description: VALID_DESCRIPTION,
    }, makeCtx('provider_001', 'provider'))
    expect(result['ok']).toBe(true)
  })

  it('works for completed order status', async () => {
    setupDisputeMocks({
      order: makeDocSnap('ord_comp', {
        customerId: 'customer_001', providerId: 'provider_001', status: 'completed',
      }),
    })
    collectionMocks.set('orders', () => makeChain(makeEmptySnap([
      makeDocSnap('ord_comp', {
        customerId: 'customer_001', providerId: 'provider_001', status: 'completed',
      }),
    ])))
    const result = await callDispute({
      orderId: 'ord_comp', reason: 'quality_issue',
      description: VALID_DESCRIPTION,
    }, makeCtx())
    expect(result['ok']).toBe(true)
  })

  it('accepts evidence URLs (up to 5)', async () => {
    setupDisputeMocks()
    const result = await callDispute({
      orderId: 'ord_003', reason: 'fraud',
      description: VALID_DESCRIPTION,
      evidenceUrls: ['https://storage.example.com/ev1.jpg', 'https://storage.example.com/ev2.jpg'],
    }, makeCtx())
    expect(result['ok']).toBe(true)
  })
})
