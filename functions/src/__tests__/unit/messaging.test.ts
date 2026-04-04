// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — Messaging Cloud Functions
// sendMessage + getOrCreateConversation + markRead
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
const mockBatch        = jest.fn(() => ({
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}))

const mockUpdate = jest.fn(() => Promise.resolve())
const mockSet    = jest.fn(() => Promise.resolve())

const mockRunTransaction = jest.fn(
  async (fn: (tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock }) => Promise<unknown>) => {
    // Default: simulate empty rate-limit window (0 hits)
    const txGet = jest.fn().mockResolvedValue({ data: () => ({ hits: [] }) })
    return fn({ get: txGet, set: jest.fn(), update: jest.fn() })
  }
)

// Per-collection mock dispatch
const collectionMocks = new Map<string, () => unknown>()

const mockFirestore = jest.fn(() => ({
  collection: jest.fn((name: string) => {
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
  chain['doc']     = jest.fn((id?: string) => {
    // When .doc(id).get() is called, find the specific document in the snap
    // so the code receives a DocumentSnapshot (with .exists and .data()), not a QuerySnapshot
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
import { sendMessage, getOrCreateConversation, markRead } from '../../messaging/index'

const callSend    = sendMessage              as unknown as Fn
const callConv    = getOrCreateConversation  as unknown as Fn
const callMark    = markRead                 as unknown as Fn

// ── Shared fixtures ───────────────────────────────────────────────────────────

const CONVERSATION = makeDocSnap('conv_001', {
  id:          'conv_001',
  orderId:     'ord_001',
  customerId:  'customer_001',
  providerId:  'provider_001',
})

const ORDER_WITH_PROVIDER = makeDocSnap('ord_001', {
  id:         'ord_001',
  customerId: 'customer_001',
  providerId: 'provider_001',
  status:     'confirmed',
})

const ORDER_NO_PROVIDER = makeDocSnap('ord_002', {
  id:         'ord_002',
  customerId: 'customer_001',
  providerId: null,
  status:     'pending',
})

const USER_DOC = makeDocSnap('customer_001', {
  displayName: 'Ahmed',
  avatarUrl:   null,
})

// ══════════════════════════════════════════════════════════════════════════════
// §1  sendMessage — auth & input validation
// ══════════════════════════════════════════════════════════════════════════════

describe('sendMessage() — auth & validation', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws unauthenticated when auth is missing', async () => {
    await expect(
      callSend({ conversationId: 'conv_001', text: 'Hello' }, { auth: null })
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('throws invalid-argument for missing conversationId', async () => {
    await expect(
      callSend({ conversationId: '', text: 'Hello' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument when neither text nor mediaUrl is provided', async () => {
    await expect(
      callSend({ conversationId: 'conv_001' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument when text exceeds 2000 chars', async () => {
    await expect(
      callSend({ conversationId: 'conv_001', text: 'x'.repeat(2001) }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument for invalid mediaUrl format', async () => {
    await expect(
      callSend({ conversationId: 'conv_001', mediaUrl: 'not-a-url', mediaType: 'image' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument for invalid mediaType', async () => {
    await expect(
      callSend({
        conversationId: 'conv_001',
        mediaUrl:  'https://storage.example.com/img.jpg',
        mediaType: 'video',
      }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §2  sendMessage — business logic
// ══════════════════════════════════════════════════════════════════════════════

describe('sendMessage() — business logic', () => {
  beforeEach(() => jest.clearAllMocks())

  function setupSendMocks(options: {
    conversation?: ReturnType<typeof makeDocSnap>
    user?: ReturnType<typeof makeDocSnap>
  } = {}) {
    const conv = options.conversation ?? CONVERSATION
    const user = options.user ?? USER_DOC
    collectionMocks.set('conversations', () => makeChain(makeEmptySnap([conv])))
    collectionMocks.set('users', () => makeChain(makeEmptySnap([user])))
    collectionMocks.set('_rateLimits', () => makeEmptyChain())
  }

  it('throws not-found when conversation does not exist', async () => {
    collectionMocks.set('conversations', () =>
      makeChain(makeEmptySnap([makeDocSnap('conv_missing', {}, false)]))
    )
    collectionMocks.set('_rateLimits', () => makeEmptyChain())
    await expect(
      callSend({ conversationId: 'conv_missing', text: 'Hello' }, makeCtx())
    ).rejects.toMatchObject({ code: 'not-found' })
  })

  it('throws permission-denied when caller is not a party', async () => {
    setupSendMocks()
    await expect(
      callSend({ conversationId: 'conv_001', text: 'Hello' }, makeCtx('stranger_999'))
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('returns ok=true and messageId on success (text message)', async () => {
    setupSendMocks()
    const result = await callSend({
      conversationId: 'conv_001',
      text: 'السلام عليكم، متى تتمكن من المجيء؟',
    }, makeCtx('customer_001', 'customer'))
    expect(result['ok']).toBe(true)
    expect(result['messageId']).toBeTruthy()
  })

  it('returns ok=true for image message (mediaUrl + mediaType)', async () => {
    setupSendMocks()
    const result = await callSend({
      conversationId: 'conv_001',
      mediaUrl:  'https://storage.example.com/photo.jpg',
      mediaType: 'image',
    }, makeCtx('customer_001', 'customer'))
    expect(result['ok']).toBe(true)
  })

  it('returns ok=true for document message', async () => {
    setupSendMocks()
    const result = await callSend({
      conversationId: 'conv_001',
      mediaUrl:  'https://storage.example.com/contract.pdf',
      mediaType: 'document',
    }, makeCtx('provider_001', 'provider'))
    expect(result['ok']).toBe(true)
  })

  it('provider can also send messages in the conversation', async () => {
    setupSendMocks({
      user: makeDocSnap('provider_001', { displayName: 'Mohammed', avatarUrl: null }),
    })
    const result = await callSend({
      conversationId: 'conv_001',
      text: 'سأكون عندك الساعة 3 عصراً',
    }, makeCtx('provider_001', 'provider'))
    expect(result['ok']).toBe(true)
  })

  it('message with both text and media is accepted', async () => {
    setupSendMocks()
    const result = await callSend({
      conversationId: 'conv_001',
      text:      'هذه صورة للمشكلة',
      mediaUrl:  'https://storage.example.com/problem.jpg',
      mediaType: 'image',
    }, makeCtx('customer_001', 'customer'))
    expect(result['ok']).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §3  getOrCreateConversation — auth & validation
// ══════════════════════════════════════════════════════════════════════════════

describe('getOrCreateConversation() — auth & validation', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws unauthenticated when auth is missing', async () => {
    await expect(
      callConv({ orderId: 'ord_001' }, { auth: null })
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('throws invalid-argument for missing orderId', async () => {
    await expect(
      callConv({ orderId: '' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §4  getOrCreateConversation — business logic
// ══════════════════════════════════════════════════════════════════════════════

describe('getOrCreateConversation() — business logic', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns existing conversationId if conversation already exists', async () => {
    collectionMocks.set('conversations', () =>
      makeChain(makeEmptySnap([CONVERSATION]))
    )
    const result = await callConv({ orderId: 'ord_001' }, makeCtx())
    expect(result['ok']).toBe(true)
    expect(result['conversationId']).toBe('conv_001')
  })

  it('throws not-found when order does not exist', async () => {
    collectionMocks.set('conversations', () => makeChain(makeEmptySnap()))
    collectionMocks.set('orders', () =>
      makeChain(makeEmptySnap([makeDocSnap('ord_missing', {}, false)]))
    )
    await expect(
      callConv({ orderId: 'ord_missing' }, makeCtx())
    ).rejects.toMatchObject({ code: 'not-found' })
  })

  it('throws when order has no provider assigned yet', async () => {
    collectionMocks.set('conversations', () => makeChain(makeEmptySnap()))
    collectionMocks.set('orders', () => makeChain(makeEmptySnap([ORDER_NO_PROVIDER])))
    await expect(
      callConv({ orderId: 'ord_002' }, makeCtx())
    ).rejects.toThrow()
  })

  it('throws permission-denied when caller is not a party to the order', async () => {
    collectionMocks.set('conversations', () => makeChain(makeEmptySnap()))
    collectionMocks.set('orders', () => makeChain(makeEmptySnap([ORDER_WITH_PROVIDER])))
    await expect(
      callConv({ orderId: 'ord_001' }, makeCtx('stranger_999'))
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('creates a new conversation and returns its ID', async () => {
    collectionMocks.set('conversations', () => makeChain(makeEmptySnap()))
    collectionMocks.set('orders', () => makeChain(makeEmptySnap([ORDER_WITH_PROVIDER])))
    const result = await callConv({ orderId: 'ord_001' }, makeCtx('customer_001'))
    expect(result['ok']).toBe(true)
    expect(result['conversationId']).toBeTruthy()
  })

  it('provider can also create a conversation for the same order', async () => {
    collectionMocks.set('conversations', () => makeChain(makeEmptySnap()))
    collectionMocks.set('orders', () => makeChain(makeEmptySnap([ORDER_WITH_PROVIDER])))
    const result = await callConv({ orderId: 'ord_001' }, makeCtx('provider_001', 'provider'))
    expect(result['ok']).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// §5  markRead — auth & business logic
// ══════════════════════════════════════════════════════════════════════════════

describe('markRead()', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws unauthenticated when auth is missing', async () => {
    await expect(
      callMark({ conversationId: 'conv_001' }, { auth: null })
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('throws invalid-argument for missing conversationId', async () => {
    await expect(
      callMark({ conversationId: '' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('returns ok=true when no unread messages exist', async () => {
    // conversation.doc().update resolves
    // conversation.doc().collection('messages').where(...).get() = empty
    const convChain = makeChain(makeEmptySnap())
    collectionMocks.set('conversations', () => convChain)

    const result = await callMark({ conversationId: 'conv_001' }, makeCtx())
    expect(result['ok']).toBe(true)
  })

  it('marks unread messages and returns markedCount when messages exist', async () => {
    // Set up conversation doc + messages subcollection with 2 unread messages
    const unreadMsg1 = makeDocSnap('msg_001', { senderId: 'provider_001', isRead: false })
    const unreadMsg2 = makeDocSnap('msg_002', { senderId: 'provider_001', isRead: false })
    const unreadSnap = { empty: false, size: 2, docs: [unreadMsg1, unreadMsg2] }

    const messagesChain = {
      where: jest.fn().mockReturnThis(),
      get:   jest.fn().mockResolvedValue(unreadSnap),
    }

    const docRef = {
      update:     mockUpdate,
      collection: jest.fn(() => messagesChain),
      id:         'conv_001',
    }

    const convCollectionChain = {
      doc: jest.fn(() => docRef),
    }

    collectionMocks.set('conversations', () => convCollectionChain)

    const result = await callMark({ conversationId: 'conv_001' }, makeCtx('customer_001'))
    expect(result['ok']).toBe(true)
    expect(result['markedCount']).toBe(2)
  })
})
