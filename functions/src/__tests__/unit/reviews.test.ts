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

const mockRunTransaction = jest.fn()

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
    const collSnap = snap as { docs?: Array<{ id: string; exists: boolean; data: () => Record<string, unknown> }> }
    const docSnap  = collSnap?.docs?.find((d) => d.id === id)
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
    app: { appId: 'test-app-id' },  // App Check satisfied
  }
}

type Fn = (data: unknown, ctx: unknown) => Promise<Record<string, unknown>>

// ── Imports AFTER mocks ───────────────────────────────────────────────────────
import { submitReview, openDispute } from '../../reviews/index'

const callReview  = submitReview  as unknown as Fn
const callDispute = openDispute   as unknown as Fn

// ── Shared fixtures ───────────────────────────────────────────────────────────

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

// ── Mock setup helpers ────────────────────────────────────────────────────────

/**
 * Configure transaction mocks.
 * - First call  → rate limit transaction (always passes)
 * - Second call → review write transaction
 */
function setupTransactions(opts: { reviewExists?: boolean } = {}) {
  const { reviewExists = false } = opts

  mockRunTransaction
    .mockImplementationOnce(
      // Rate limit tx
      async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) => {
        const txGet = jest.fn().mockResolvedValue({ data: () => ({ hits: [] }) })
        return fn({ get: txGet, set: jest.fn(), update: jest.fn() })
      },
    )
    .mockImplementationOnce(
      // Review write tx
      async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) => {
        let innerCall = 0
        const txGet = jest.fn().mockImplementation(async () => {
          innerCall++
          return innerCall === 1
            ? makeDocSnap('review_id', {}, !reviewExists)  // reviewRef: exists?
            : PROVIDER_PROFILE                               // profileRef
        })
        return fn({ get: txGet, set: jest.fn(), update: jest.fn() })
      },
    )
}

/** Only sets up the rate limit tx — for tests that fail before the review write. */
function setupRateLimitOnly() {
  collectionMocks.set('_rateLimits', () => makeEmptyChain())
  mockRunTransaction.mockImplementationOnce(
    async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) => {
      const txGet = jest.fn().mockResolvedValue({ data: () => ({ hits: [] }) })
      return fn({ get: txGet, set: jest.fn(), update: jest.fn() })
    },
  )
}

/**
 * Full happy-path mock setup.
 * @param reviewExists        Simulate duplicate in the write transaction
 * @param existingReviewCount Number of reviews returned by anomaly detection query
 * @param cachedIdempotencyKey  Simulate a cached idempotency key result
 */
function setupReviewMocks(opts: {
  order?:                   ReturnType<typeof makeDocSnap>
  reviewExists?:            boolean
  existingReviewCount?:     number
  cachedIdempotencyKey?:    string   // if set, _idempotencyKeys returns a cached result
  cachedIdempotencyResult?: { ok: boolean; reviewId: string }
} = {}) {
  const order              = opts.order              ?? CLOSED_ORDER
  const reviewExists       = opts.reviewExists       ?? false
  const reviewCount        = opts.existingReviewCount ?? 1

  collectionMocks.set('orders', () => makeChain(makeEmptySnap([order])))
  collectionMocks.set('users',  () => makeChain(makeEmptySnap([USER_DOC])))
  collectionMocks.set('providerProfiles', () => makeChain(makeEmptySnap([PROVIDER_PROFILE])))
  collectionMocks.set('_rateLimits',      () => makeEmptyChain())
  collectionMocks.set('reviews', () =>
    makeChain(makeEmptySnap(
      Array.from({ length: reviewCount }, (_, i) =>
        makeDocSnap(`rev_${i}`, { reviewerId: 'customer_001', targetId: 'provider_001' }),
      ),
    )),
  )

  // Idempotency key collection
  if (opts.cachedIdempotencyKey) {
    const keyDocId = `review_${opts.cachedIdempotencyKey}_customer_001`
    const cachedResult = opts.cachedIdempotencyResult ?? { ok: true, reviewId: 'cached_review_id' }
    collectionMocks.set('_idempotencyKeys', () =>
      makeChain(makeEmptySnap([
        makeDocSnap(keyDocId, { uid: 'customer_001', result: cachedResult }),
      ])),
    )
  } else {
    collectionMocks.set('_idempotencyKeys', () => makeEmptyChain())
  }

  setupTransactions({ reviewExists })
}

// ══════════════════════════════════════════════════════════════════════════════
// §1  submitReview — auth & input validation
// ══════════════════════════════════════════════════════════════════════════════

describe('submitReview() — auth & validation', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws unauthenticated when auth is missing', async () => {
    await expect(
      callReview({ orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider', rating: 5 }, { auth: null, app: { appId: 'test' } })
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('throws invalid-argument for missing orderId', async () => {
    setupRateLimitOnly()
    await expect(
      callReview({ orderId: '', targetId: 'provider_001', targetType: 'provider', rating: 5 }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument for rating < 1', async () => {
    setupRateLimitOnly()
    await expect(
      callReview({ orderId: 'ord_001', targetId: 'p1', targetType: 'provider', rating: 0 }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument for rating > 5', async () => {
    setupRateLimitOnly()
    await expect(
      callReview({ orderId: 'ord_001', targetId: 'p1', targetType: 'provider', rating: 6 }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument for non-integer rating', async () => {
    setupRateLimitOnly()
    await expect(
      callReview({ orderId: 'ord_001', targetId: 'p1', targetType: 'provider', rating: 3.5 }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument for invalid targetType', async () => {
    setupRateLimitOnly()
    await expect(
      callReview({ orderId: 'ord_001', targetId: 'p1', targetType: 'admin', rating: 4 }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument when comment exceeds 500 chars', async () => {
    setupRateLimitOnly()
    await expect(
      callReview({
        orderId: 'ord_001', targetId: 'p1', targetType: 'provider',
        rating: 4, comment: 'x'.repeat(501),
      }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument when tags array exceeds 6 items', async () => {
    setupRateLimitOnly()
    await expect(
      callReview({
        orderId: 'ord_001', targetId: 'p1', targetType: 'provider',
        rating: 4, tags: ['a','b','c','d','e','f','g'],
      }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §2  submitReview — role enforcement
// ══════════════════════════════════════════════════════════════════════════════

describe('submitReview() — role enforcement', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws permission-denied when customer tries to review a customer', async () => {
    setupRateLimitOnly()
    await expect(
      callReview(
        { orderId: 'ord_001', targetId: 'customer_002', targetType: 'customer', rating: 4 },
        makeCtx('customer_001', 'customer'),
      )
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('throws permission-denied when provider tries to review a provider', async () => {
    setupRateLimitOnly()
    await expect(
      callReview(
        { orderId: 'ord_001', targetId: 'another_provider', targetType: 'provider', rating: 4 },
        makeCtx('provider_001', 'provider'),
      )
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('throws permission-denied when reviewer targets themselves', async () => {
    setupRateLimitOnly()
    await expect(
      callReview(
        { orderId: 'ord_001', targetId: 'customer_001', targetType: 'provider', rating: 4 },
        makeCtx('customer_001', 'customer'),
      )
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §3  submitReview — business logic
// ══════════════════════════════════════════════════════════════════════════════

describe('submitReview() — business logic', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws not-found when order does not exist', async () => {
    setupReviewMocks()
    collectionMocks.set('orders', () =>
      makeChain(makeEmptySnap([makeDocSnap('ord_missing', {}, false)]))
    )
    await expect(
      callReview({ orderId: 'ord_missing', targetId: 'p1', targetType: 'provider', rating: 4 }, makeCtx())
    ).rejects.toMatchObject({ code: 'not-found' })
  })

  it('throws permission-denied when reviewer is not a party to the order', async () => {
    setupReviewMocks()
    await expect(
      callReview(
        { orderId: 'ord_001', targetId: 'p1', targetType: 'provider', rating: 4 },
        makeCtx('stranger_999', 'customer'),
      )
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('throws permission-denied when targetId does not match order counterparty', async () => {
    setupReviewMocks()
    await expect(
      callReview(
        // provider_001 is correct, but user supplies a wrong targetId
        { orderId: 'ord_001', targetId: 'wrong_provider_999', targetType: 'provider', rating: 4 },
        makeCtx('customer_001', 'customer'),
      )
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('throws when order status is not closed/completed', async () => {
    setupReviewMocks({ order: PENDING_ORDER })
    await expect(
      callReview({ orderId: 'ord_002', targetId: 'provider_001', targetType: 'provider', rating: 4 }, makeCtx())
    ).rejects.toThrow()
  })

  it('throws already-exists when review duplicate detected in transaction', async () => {
    setupReviewMocks({ reviewExists: true })
    await expect(
      callReview({ orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider', rating: 4 }, makeCtx())
    ).rejects.toMatchObject({ code: 'already-exists' })
  })

  it('returns ok=true and a reviewId on success', async () => {
    setupReviewMocks()
    const result = await callReview({
      orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider',
      rating: 5, comment: 'Excellent service',
    }, makeCtx())
    expect(result['ok']).toBe(true)
    expect(result['reviewId']).toBe('ord_001_customer_001')
  })

  it('provider can review a customer (targetType=customer)', async () => {
    collectionMocks.set('orders',          () => makeChain(makeEmptySnap([CLOSED_ORDER])))
    collectionMocks.set('users',           () => makeChain(makeEmptySnap([
      makeDocSnap('provider_001', { displayName: 'Mohammed', avatarUrl: null }),
    ])))
    collectionMocks.set('providerProfiles', () => makeEmptyChain())
    collectionMocks.set('_rateLimits',     () => makeEmptyChain())
    collectionMocks.set('_idempotencyKeys',() => makeEmptyChain())
    collectionMocks.set('reviews',         () => makeChain(makeEmptySnap([
      makeDocSnap('rev_0', { reviewerId: 'provider_001', targetId: 'customer_001' }),
    ])))

    setupTransactions()

    const result = await callReview({
      orderId: 'ord_001', targetId: 'customer_001', targetType: 'customer',
      rating: 4,
    }, makeCtx('provider_001', 'provider'))
    expect(result['ok']).toBe(true)
  })

  it('updates provider avgRating atomically inside the review transaction', async () => {
    setupReviewMocks()

    let ratingUpdateCalled = false
    mockRunTransaction
      .mockImplementationOnce(
        // Rate limit tx
        async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) => {
          const txGet = jest.fn().mockResolvedValue({ data: () => ({ hits: [] }) })
          return fn({ get: txGet, set: jest.fn(), update: jest.fn() })
        },
      )
      .mockImplementationOnce(
        // Review write + rating update tx
        async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) => {
          let innerCall = 0
          const txGet = jest.fn().mockImplementation(async () => {
            innerCall++
            return innerCall === 1
              ? makeDocSnap('review_id', {}, false)
              : PROVIDER_PROFILE
          })
          const txUpdate = jest.fn().mockImplementation(() => { ratingUpdateCalled = true })
          return fn({ get: txGet, set: jest.fn(), update: txUpdate })
        },
      )

    await callReview({
      orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider', rating: 5,
    }, makeCtx())

    expect(ratingUpdateCalled).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §4  submitReview — idempotency
// ══════════════════════════════════════════════════════════════════════════════

describe('submitReview() — idempotency', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns cached result for a retried request with the same idempotency key', async () => {
    setupReviewMocks({ cachedIdempotencyKey: 'idem_001', cachedIdempotencyResult: { ok: true, reviewId: 'cached_review_id' } })

    const result = await callReview({
      orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider',
      rating: 5, idempotencyKey: 'idem_001',
    }, makeCtx())

    expect(result['ok']).toBe(true)
    expect(result['reviewId']).toBe('cached_review_id')
    // Review write transaction must NOT be called (short-circuit after cache hit)
    expect(mockRunTransaction).toHaveBeenCalledTimes(1) // only rate limit tx
  })

  it('proceeds normally when idempotency key has no cached result', async () => {
    setupReviewMocks() // _idempotencyKeys returns empty chain (no cache)

    const result = await callReview({
      orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider',
      rating: 4, idempotencyKey: 'new_key_001',
    }, makeCtx())

    expect(result['ok']).toBe(true)
    expect(mockRunTransaction).toHaveBeenCalledTimes(2) // rate limit + review write
  })

  it('proceeds normally when no idempotency key is supplied', async () => {
    setupReviewMocks()

    const result = await callReview({
      orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider', rating: 3,
    }, makeCtx())

    expect(result['ok']).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §5  submitReview — anomaly detection
// ══════════════════════════════════════════════════════════════════════════════

describe('submitReview() — anomaly detection', () => {
  beforeEach(() => jest.clearAllMocks())

  it('logs security alert when reviewer has >= 4 reviews targeting the same counterparty', async () => {
    setupReviewMocks({ existingReviewCount: 4 })

    await callReview({
      orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider', rating: 3,
    }, makeCtx())

    // logger.security → functions.logger.warn('[SECURITY] review_burst_anomaly', ...)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[SECURITY] review_burst_anomaly',
      expect.objectContaining({ securityEvent: 'review_burst_anomaly', uid: 'customer_001', targetId: 'provider_001', count: 4 }),
    )
  })

  it('does not log anomaly when reviewer has < 4 reviews for the target', async () => {
    setupReviewMocks({ existingReviewCount: 2 })

    await callReview({
      orderId: 'ord_001', targetId: 'provider_001', targetType: 'provider', rating: 5,
    }, makeCtx())

    const anomalyCalls = mockLogger.warn.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('review_burst_anomaly'),
    )
    expect(anomalyCalls).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §6  openDispute — auth & validation
// ══════════════════════════════════════════════════════════════════════════════

describe('openDispute() — auth & validation', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws unauthenticated when auth is missing', async () => {
    await expect(
      callDispute({ orderId: 'ord_001', reason: 'not_completed', description: 'x'.repeat(20) }, { auth: null, app: { appId: 'test' } })
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('throws invalid-argument for missing orderId', async () => {
    setupRateLimitOnly()
    await expect(
      callDispute({ orderId: '', reason: 'fraud', description: 'y'.repeat(20) }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument when description < 20 chars', async () => {
    setupRateLimitOnly()
    await expect(
      callDispute({ orderId: 'ord_001', reason: 'not_done', description: 'too short' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument when description > 1000 chars', async () => {
    setupRateLimitOnly()
    await expect(
      callDispute({ orderId: 'ord_001', reason: 'fraud', description: 'x'.repeat(1001) }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument when evidenceUrls has more than 5 items', async () => {
    setupRateLimitOnly()
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
// §7  openDispute — business logic
// ══════════════════════════════════════════════════════════════════════════════

describe('openDispute() — business logic', () => {
  const VALID_DESCRIPTION = 'العمل لم يُكتمل كما اتفقنا عليه في البداية'

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
