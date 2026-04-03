// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — GDPR Cloud Functions
// requestDataExport + requestAccountDeletion + cancelAccountDeletion
// + executeAccountDeletion (anonymise/hard-delete logic)
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. firebase-functions mock ────────────────────────────────────────────────
class MockHttpsError extends Error {
  code: string; details: unknown
  constructor(code: string, msg: string, details?: unknown) {
    super(msg); this.name = 'HttpsError'; this.code = code; this.details = details
  }
}
const mockOnCall    = jest.fn((fn: unknown) => fn)
const mockOnRequest = jest.fn((fn: unknown) => fn)
const mockHttps     = { HttpsError: MockHttpsError, onCall: mockOnCall, onRequest: mockOnRequest }
const mockLogger    = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), security: jest.fn() }

jest.mock('firebase-functions', () => ({
  https:  mockHttps,
  region: jest.fn(() => ({ https: mockHttps, pubsub: { schedule: jest.fn(() => ({ onRun: jest.fn(fn => fn) })) } })),
  logger: mockLogger,
}))

// ── 2. firebase-admin mock ────────────────────────────────────────────────────
const mockBatchCommit  = jest.fn(() => Promise.resolve())
const mockBatchUpdate  = jest.fn()
const mockBatchDelete  = jest.fn()
const mockBatchSet     = jest.fn()
const mockBatch        = jest.fn(() => ({
  update: mockBatchUpdate, delete: mockBatchDelete,
  set:    mockBatchSet,    commit: mockBatchCommit,
}))

const mockUpdate = jest.fn(() => Promise.resolve())
const mockSet    = jest.fn(() => Promise.resolve())
const mockAdd    = jest.fn(() => Promise.resolve({ id: 'audit_001' }))
const mockGet    = jest.fn()
const mockDelete = jest.fn(() => Promise.resolve())

const mockFileSave        = jest.fn(() => Promise.resolve())
const mockFileGetSignedUrl = jest.fn(() => Promise.resolve(['https://storage.example.com/export.json']))
const mockBucketFile      = jest.fn(() => ({
  save: mockFileSave, getSignedUrl: mockFileGetSignedUrl,
}))
const mockBucketDeleteFiles = jest.fn(() => Promise.resolve())
const mockBucket          = jest.fn(() => ({
  file: mockBucketFile, deleteFiles: mockBucketDeleteFiles,
}))

const mockRevokeRefreshTokens = jest.fn(() => Promise.resolve())
const mockDeleteUser          = jest.fn(() => Promise.resolve())
const mockSetCustomUserClaims = jest.fn(() => Promise.resolve())
const mockGetUser             = jest.fn(() => Promise.resolve({ customClaims: {}, displayName: 'Test' }))

const mockRunTransaction = jest.fn(
  async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) => {
    const txGet = jest.fn().mockResolvedValue({ data: () => ({ hits: [] }) })
    return fn({ get: txGet, set: jest.fn(), update: jest.fn() })
  }
)

// Collection mock — dispatches by name
const collectionMocks = new Map<string, () => unknown>()

const mockFirestore = jest.fn(() => ({
  collection:     jest.fn((name: string) => {
    const factory = collectionMocks.get(name)
    return factory ? factory() : makeEmptyChain()
  }),
  batch: mockBatch,
  runTransaction: mockRunTransaction,
  doc: jest.fn(),
}))

Object.assign(mockFirestore, {
  FieldValue: {
    serverTimestamp: jest.fn(() => '__ts__'),
    increment:       jest.fn((n: number) => n),
    arrayUnion:      jest.fn((...a: unknown[]) => a),
    arrayRemove:     jest.fn((...a: unknown[]) => a),
  },
  Timestamp: {
    fromDate: jest.fn((d: Date) => ({ toDate: () => d, seconds: d.getTime() / 1000 })),
    now:      jest.fn(() => ({ toDate: () => new Date() })),
  },
  GeoPoint: class { constructor(public lat: number, public lng: number) {} },
})

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore:     mockFirestore,
  auth:          jest.fn(() => ({
    revokeRefreshTokens: mockRevokeRefreshTokens,
    deleteUser:          mockDeleteUser,
    setCustomUserClaims: mockSetCustomUserClaims,
    getUser:             mockGetUser,
  })),
  storage:   jest.fn(() => ({ bucket: mockBucket })),
  messaging: jest.fn(() => ({})),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeEmptySnap(docs: unknown[] = []) {
  return { empty: docs.length === 0, size: docs.length, docs }
}

function makeDocSnap(id: string, data: Record<string, unknown>, exists = true) {
  return {
    id, exists,
    ref: { update: mockUpdate, delete: mockDelete, id },
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
  chain['select']  = jest.fn(() => ({ get: getMock }))
  chain['get']     = getMock
  chain['update']  = mockUpdate
  chain['set']     = mockSet
  chain['add']     = mockAdd
  chain['delete']  = mockDelete
  chain['doc']     = jest.fn((id?: string) => ({
    get: getMock, update: mockUpdate, set: mockSet, delete: mockDelete,
    id: id ?? 'doc_001',
    ref: { update: mockUpdate, delete: mockDelete, id: id ?? 'doc_001' },
    collection: jest.fn(() => makeChain(makeEmptySnap())),
  }))
  return chain as unknown as jest.Mock
}

function makeEmptyChain() { return makeChain(makeEmptySnap()) }

function makeCtx(uid = 'user_001', role = 'customer', email = 'user@test.com') {
  return {
    auth: { uid, token: { role } },
    rawRequest: { ip: '127.0.0.1' },
  }
}

type Fn = (data: unknown, ctx: unknown) => Promise<Record<string, unknown>>

// ─────────────────────────────────────────────────────────────────────────────
// Import AFTER mocks
// ─────────────────────────────────────────────────────────────────────────────
import { requestDataExport }                         from '../../user/dataExport'
import { requestAccountDeletion, cancelAccountDeletion,
         executeAccountDeletion,
         anonymiseFinancialRecords }                from '../../user/accountDeletion'

const callExport    = requestDataExport    as unknown as Fn
const callDelete    = requestAccountDeletion as unknown as Fn
const callCancel    = cancelAccountDeletion as unknown as Fn

// ══════════════════════════════════════════════════════════════════════════════
// §1  requestDataExport
// ══════════════════════════════════════════════════════════════════════════════

describe('requestDataExport()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRunTransaction.mockImplementation(
      async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) =>
        fn({ get: jest.fn().mockResolvedValue({ data: () => ({ hits: [] }) }), set: jest.fn(), update: jest.fn() })
    )
  })

  function setupExportMocks(existingExport: unknown = null) {
    // dataExports collection — no recent export by default
    const exportChain = makeChain(makeEmptySnap())
    if (existingExport) {
      const exportChainWithResult = makeChain(makeEmptySnap([existingExport]))
      collectionMocks.set('dataExports', () => exportChainWithResult)
    } else {
      collectionMocks.set('dataExports', () => exportChain)
    }
    // _rateLimits, _taskQueue, _auditLogs
    collectionMocks.set('_rateLimits', () => makeEmptyChain())
    collectionMocks.set('_taskQueue', () => makeEmptyChain())
    collectionMocks.set('_auditLogs', () => makeEmptyChain())
  }

  it('returns status="queued" and exportId for new export request', async () => {
    setupExportMocks()
    const res = await callExport({}, makeCtx())
    expect(res['status']).toBe('queued')
    expect(res['exportId']).toBeTruthy()
    expect(res['downloadUrl']).toBeNull()
  })

  it('sets an expiresAt 7 days from now', async () => {
    setupExportMocks()
    const res = await callExport({}, makeCtx())
    const expires = new Date(res['expiresAt'] as string)
    const diff = expires.getTime() - Date.now()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    // Allow ±60 seconds tolerance
    expect(diff).toBeGreaterThan(sevenDaysMs - 60_000)
    expect(diff).toBeLessThan(sevenDaysMs + 60_000)
  })

  it('returns existing export if already queued (deduplication)', async () => {
    const existingExport = makeDocSnap('export_existing', {
      id:          'export_existing',
      uid:         'user_001',
      status:      'pending',
      downloadUrl: null,
      expiresAt:   { toDate: () => new Date(Date.now() + 86_400_000) },
      createdAt:   { toDate: () => new Date() },
    })
    setupExportMocks(existingExport)
    const res = await callExport({}, makeCtx())
    expect(res['status']).toBe('queued')
    expect(res['exportId']).toBe('export_existing')
  })

  it('returns downloadUrl immediately if export is already ready', async () => {
    const readyExport = makeDocSnap('export_ready', {
      id:          'export_ready',
      uid:         'user_001',
      status:      'ready',
      downloadUrl: 'https://storage.example.com/export.json',
      expiresAt:   { toDate: () => new Date(Date.now() + 86_400_000) },
      createdAt:   { toDate: () => new Date() },
    })
    setupExportMocks(readyExport)
    const res = await callExport({}, makeCtx())
    expect(res['status']).toBe('ready')
    expect(res['downloadUrl']).toBe('https://storage.example.com/export.json')
  })

  it('throws unauthenticated when auth is missing', async () => {
    await expect(callExport({}, { auth: null }))
      .rejects.toMatchObject({ code: 'unauthenticated' })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §2  requestAccountDeletion
// ══════════════════════════════════════════════════════════════════════════════

describe('requestAccountDeletion()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRunTransaction.mockImplementation(
      async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) =>
        fn({ get: jest.fn().mockResolvedValue({ data: () => ({ hits: [] }) }), set: jest.fn(), update: jest.fn() })
    )
  })

  function setupDeleteMocks(options: {
    existingRequest?: unknown
    activeOrders?: boolean
    openDisputes?: boolean
    pendingPayouts?: boolean
  } = {}) {
    // deletionRequests
    const reqChain = options.existingRequest
      ? makeChain(makeEmptySnap([options.existingRequest]))
      : makeChain(makeEmptySnap())
    collectionMocks.set('deletionRequests', () => ({
      ...reqChain,
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(
          options.existingRequest
            ? (options.existingRequest as { exists: boolean })
            : { exists: false }
        ),
        update: mockUpdate, set: mockSet,
      })),
    }))

    // orders (blocker check)
    collectionMocks.set('orders', () =>
      makeChain(makeEmptySnap(options.activeOrders ? [makeDocSnap('ord_001', { status: 'in_progress' })] : []))
    )
    // disputes
    collectionMocks.set('disputes', () =>
      makeChain(makeEmptySnap(options.openDisputes ? [makeDocSnap('dis_001', { status: 'open' })] : []))
    )
    // payouts
    collectionMocks.set('payouts', () =>
      makeChain(makeEmptySnap(options.pendingPayouts ? [makeDocSnap('pay_001', { status: 'pending' })] : []))
    )
    // users
    collectionMocks.set('users', () => makeChain(makeEmptySnap([makeDocSnap('user_001', { role: 'customer' })])))
    // supporting
    collectionMocks.set('_rateLimits', () => makeEmptyChain())
    collectionMocks.set('_taskQueue', () => makeEmptyChain())
    collectionMocks.set('_auditLogs', () => makeEmptyChain())
  }

  it('schedules deletion and returns scheduledFor 30 days from now', async () => {
    setupDeleteMocks()
    const res = await callDelete(
      { confirmation: 'DELETE MY ACCOUNT', reason: 'no_longer_using' },
      makeCtx()
    )
    expect(res['status']).toBe('scheduled')
    expect(res['scheduledFor']).toBeTruthy()
    const scheduled = new Date(res['scheduledFor'] as string)
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    expect(scheduled.getTime() - Date.now()).toBeGreaterThan(thirtyDays - 60_000)
  })

  it('includes retentionNote in the response', async () => {
    setupDeleteMocks()
    const res = await callDelete(
      { confirmation: 'DELETE MY ACCOUNT' },
      makeCtx()
    )
    expect(res['retentionNote']).toBeTruthy()
    expect(typeof res['retentionNote']).toBe('string')
  })

  it('throws when active orders exist (blocker)', async () => {
    setupDeleteMocks({ activeOrders: true })
    await expect(
      callDelete({ confirmation: 'DELETE MY ACCOUNT' }, makeCtx())
    ).rejects.toThrow(/active orders/i)
  })

  it('throws when open disputes exist (blocker)', async () => {
    setupDeleteMocks({ openDisputes: true })
    await expect(
      callDelete({ confirmation: 'DELETE MY ACCOUNT' }, makeCtx())
    ).rejects.toThrow(/disputes/i)
  })

  it('throws validation error when confirmation phrase is wrong', async () => {
    setupDeleteMocks()
    await expect(
      callDelete({ confirmation: 'wrong phrase' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws unauthenticated for anonymous caller', async () => {
    await expect(callDelete({ confirmation: 'DELETE MY ACCOUNT' }, { auth: null }))
      .rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('revokes refresh tokens (signs out all devices) after scheduling', async () => {
    setupDeleteMocks()
    await callDelete({ confirmation: 'DELETE MY ACCOUNT' }, makeCtx())
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith('user_001')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §3  cancelAccountDeletion
// ══════════════════════════════════════════════════════════════════════════════

describe('cancelAccountDeletion()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRunTransaction.mockImplementation(
      async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) =>
        fn({ get: jest.fn().mockResolvedValue({ data: () => ({ hits: [] }) }), set: jest.fn(), update: jest.fn() })
    )
  })

  function setupCancelMocks(reqStatus: string | null) {
    const reqDoc = reqStatus
      ? { exists: true, data: () => ({ status: reqStatus }) }
      : { exists: false }
    collectionMocks.set('deletionRequests', () => ({
      doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue(reqDoc), update: mockUpdate })),
    }))
    collectionMocks.set('users', () => ({ doc: jest.fn(() => ({ update: mockUpdate })) }))
    collectionMocks.set('_rateLimits', () => makeEmptyChain())
    collectionMocks.set('_auditLogs', () => makeEmptyChain())
  }

  it('cancels a pending deletion and returns status=cancelled', async () => {
    setupCancelMocks('pending')
    const res = await callCancel({}, makeCtx())
    expect(res['ok']).toBe(true)
    expect(res['status']).toBe('cancelled')
  })

  it('returns no_pending_request when no deletion was requested', async () => {
    setupCancelMocks(null)
    const res = await callCancel({}, makeCtx())
    expect(res['status']).toBe('no_pending_request')
  })

  it('returns cannot_cancel when deletion already executed', async () => {
    setupCancelMocks('executed')
    const res = await callCancel({}, makeCtx())
    expect(res['status']).toBe('cannot_cancel')
  })

  it('throws unauthenticated for anonymous caller', async () => {
    await expect(callCancel({}, { auth: null }))
      .rejects.toMatchObject({ code: 'unauthenticated' })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §4  executeAccountDeletion — anonymise + hard-delete logic
// ══════════════════════════════════════════════════════════════════════════════

describe('executeAccountDeletion()', () => {
  const UID = 'user_to_delete_001'

  beforeEach(() => {
    jest.clearAllMocks()
    // Batch always succeeds
    mockBatch.mockReturnValue({
      update: mockBatchUpdate, delete: mockBatchDelete,
      set: mockBatchSet, commit: mockBatchCommit,
    })
  })

  function setupExecuteMocks(options: {
    activeOrders?: boolean
    openDisputes?: boolean
  } = {}) {
    collectionMocks.set('users', () => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(
          makeDocSnap(UID, { role: 'customer', displayName: 'Test User' })
        ),
        update: mockUpdate,
      })),
    }))

    collectionMocks.set('orders', () => {
      const chain = makeChain(makeEmptySnap(
        options.activeOrders
          ? [makeDocSnap('ord_001', { status: 'in_progress', customerId: UID })]
          : []
      ))
      return chain
    })

    collectionMocks.set('disputes', () =>
      makeChain(makeEmptySnap(options.openDisputes ? [makeDocSnap('dis_001', {})] : []))
    )

    collectionMocks.set('payouts', () => makeChain(makeEmptySnap()))

    collectionMocks.set('messages', () =>
      makeChain(makeEmptySnap([
        makeDocSnap('msg_001', { senderId: UID, content: 'hello' }),
      ]))
    )

    collectionMocks.set('reviews', () =>
      makeChain(makeEmptySnap([
        makeDocSnap('rev_001', { authorId: UID, text: 'great' }),
      ]))
    )

    collectionMocks.set('notifications', () => ({
      doc: jest.fn(() => ({
        collection: jest.fn(() => makeChain(makeEmptySnap([makeDocSnap('notif_001', {})]))),
        delete: mockDelete,
      })),
    }))

    collectionMocks.set('deletionRequests', () => ({
      doc: jest.fn(() => ({ update: mockUpdate })),
    }))

    collectionMocks.set('providerProfiles', () => ({
      doc: jest.fn(() => ({ delete: mockDelete })),
    }))

    collectionMocks.set('subscriptions', () => makeChain(makeEmptySnap()))
    collectionMocks.set('_auditLogs', () => makeEmptyChain())
    collectionMocks.set('_rateLimits', () => makeEmptyChain())
    collectionMocks.set('_taskQueue',  () => makeEmptyChain())
  }

  it('calls auth.deleteUser after processing', async () => {
    setupExecuteMocks()
    await executeAccountDeletion(UID)
    expect(mockDeleteUser).toHaveBeenCalledWith(UID)
  })

  it('calls storage.deleteFiles for user files', async () => {
    setupExecuteMocks()
    await executeAccountDeletion(UID)
    expect(mockBucketDeleteFiles).toHaveBeenCalledWith({ prefix: `users/${UID}/` })
    expect(mockBucketDeleteFiles).toHaveBeenCalledWith({ prefix: `kyc/${UID}/` })
  })

  it('marks deletion request as executed in Firestore', async () => {
    setupExecuteMocks()
    await executeAccountDeletion(UID)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'executed' })
    )
  })

  it('marks deletion as blocked (not throw) when active orders exist', async () => {
    setupExecuteMocks({ activeOrders: true })
    // Should not throw — marks as blocked instead
    await expect(executeAccountDeletion(UID)).resolves.toBeUndefined()
    // Update called with status: 'blocked'
    const blockedCall = mockUpdate.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>)?.['status'] === 'blocked'
    )
    expect(blockedCall).toBeDefined()
  })

  it('does NOT delete auth account when there are blockers', async () => {
    setupExecuteMocks({ activeOrders: true })
    await executeAccountDeletion(UID)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §5  Retention policy contract
// ══════════════════════════════════════════════════════════════════════════════

describe('Retention policy contract', () => {
  it('anonymiseFinancialRecords calls batch.update (not delete) on financial docs', async () => {
    // Direct unit test of anonymiseFinancialRecords — tests GDPR retention contract:
    // financial records (orders, payouts, reviews) must be ANONYMISED, never hard-deleted

    const UID3 = 'user_anon_test'
    const completeBatch = {
      update: jest.fn(), delete: jest.fn(),
      set: jest.fn(), commit: jest.fn().mockResolvedValue(undefined),
    }
    mockBatch.mockReturnValue(completeBatch)

    // Orders: 1 customer order + 1 provider order (same doc id → deduplication)
    const closedOrder = makeDocSnap('ord_fin_001', {
      customerId: UID3, providerId: 'other_provider',
      status: 'closed', netAmount: 250,
    })
    // Reviews authored by user
    const review = makeDocSnap('rev_001', { authorId: UID3, text: 'great service' })
    // Payout
    const payout = makeDocSnap('pay_001', { providerId: UID3, amount: 200 })

    collectionMocks.set('orders', () => makeChain(makeEmptySnap([closedOrder])))
    collectionMocks.set('reviews', () => makeChain(makeEmptySnap([review])))
    collectionMocks.set('payouts', () => makeChain(makeEmptySnap([payout])))

    await anonymiseFinancialRecords(UID3)

    // 1. A batch was created
    expect(mockBatch).toHaveBeenCalled()

    // 2. Batch was committed
    expect(completeBatch.commit).toHaveBeenCalled()

    // 3. Batch.update was called with '[Deleted User]' placeholder
    const updateCalls = completeBatch.update.mock.calls as Array<[unknown, Record<string, unknown>]>
    expect(updateCalls.length).toBeGreaterThan(0)
    const hasAnonymisedName = updateCalls.some(
      ([, data]) => data?.['customerName'] === '[Deleted User]' ||
                    data?.['providerName']  === '[Deleted User]' ||
                    data?.['authorName']    === '[Deleted User]'
    )
    expect(hasAnonymisedName).toBe(true)

    // 4. Batch.delete was NEVER called (financial records are anonymised, not deleted)
    expect(completeBatch.delete).not.toHaveBeenCalled()
  })
})
