// ─────────────────────────────────────────────────────────────────────────────
// messagingStore — unit tests
// Global firebase mocks provided by jest.setup.js
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('firebase/functions', () => ({
  getFunctions:             jest.fn(),
  httpsCallable:            jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
  connectFunctionsEmulator: jest.fn(),
}))

const mockUpdateDoc  = jest.fn(() => Promise.resolve())
const mockOnSnapshot = jest.fn(() => jest.fn())   // returns unsubscribe fn

jest.mock('firebase/firestore', () => ({
  getFirestore:                jest.fn(),
  collection:                  jest.fn(() => 'col-ref'),
  query:                       jest.fn(() => 'query-ref'),
  where:                       jest.fn(),
  orderBy:                     jest.fn(),
  limit:                       jest.fn(),
  doc:                         jest.fn(() => 'doc-ref'),
  onSnapshot:                  jest.fn(() => jest.fn()),
  updateDoc:                   jest.fn(() => Promise.resolve()),
  serverTimestamp:             jest.fn(() => new Date()),
  connectFirestoreEmulator:    jest.fn(),
  enableIndexedDbPersistence:  jest.fn(() => Promise.resolve()),
  persistentLocalCache:        jest.fn(),
  persistentMultipleTabManager: jest.fn(),
  memoryLocalCache:            jest.fn(),
  CACHE_SIZE_UNLIMITED:        -1,
}))

// ── imports ───────────────────────────────────────────────────────────────────
import { useMessagingStore } from '../../stores/messagingStore'
import type { Message }      from '@workfix/types'

// ── helpers ───────────────────────────────────────────────────────────────────
function callable() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('firebase/functions') as { httpsCallable: jest.Mock }
}

function firestoreMocks() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('firebase/firestore') as {
    onSnapshot: jest.Mock
    updateDoc:  jest.Mock
    doc:        jest.Mock
  }
}

const resetStore = () =>
  useMessagingStore.setState({
    conversations:   [],
    convsLoading:    false,
    activeConvId:    null,
    messages:        [],
    messagesLoading: false,
    typingUsers:     {},
    unreadCount:     {},
    sendLoading:     false,
    sendError:       null,
    _unsubConvs:     null,
    _unsubMessages:  null,
    _typingTimer:    null,
  })

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id:             'msg_001',
  conversationId: 'conv_001',
  senderId:       'customer_001',
  senderName:     'Ahmed',
  text:           'مرحبا',
  isRead:         false,
  sentAt:         { seconds: Date.now() / 1000, nanoseconds: 0 } as never,
  ...overrides,
})

// ─────────────────────────────────────────────────────────────────────────────
// §1  Initial state
// ─────────────────────────────────────────────────────────────────────────────

describe('messagingStore — initial state', () => {
  beforeEach(resetStore)

  it('starts with empty conversations and messages', () => {
    const s = useMessagingStore.getState()
    expect(s.conversations).toEqual([])
    expect(s.messages).toEqual([])
  })

  it('starts with no active conversation', () => {
    expect(useMessagingStore.getState().activeConvId).toBeNull()
  })

  it('starts with all loading flags false', () => {
    const s = useMessagingStore.getState()
    expect(s.convsLoading).toBe(false)
    expect(s.messagesLoading).toBe(false)
    expect(s.sendLoading).toBe(false)
  })

  it('starts with empty typing and unread maps', () => {
    const s = useMessagingStore.getState()
    expect(s.typingUsers).toEqual({})
    expect(s.unreadCount).toEqual({})
  })

  it('starts with no error', () => {
    expect(useMessagingStore.getState().sendError).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §2  clearError
// ─────────────────────────────────────────────────────────────────────────────

describe('messagingStore — clearError', () => {
  beforeEach(resetStore)

  it('clears sendError', () => {
    useMessagingStore.setState({ sendError: 'فشل إرسال الرسالة' })
    useMessagingStore.getState().clearError()
    expect(useMessagingStore.getState().sendError).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §3  sendMessage
// ─────────────────────────────────────────────────────────────────────────────

describe('messagingStore — sendMessage', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('resolves on success', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { ok: true, messageId: 'msg_new_001' } }))
    )
    await expect(
      useMessagingStore.getState().sendMessage('conv_001', 'السلام عليكم')
    ).resolves.toBeUndefined()
  })

  it('sets sendLoading=true during call, false after', async () => {
    let resolve!: () => void
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => new Promise<{ data: object }>(res => { resolve = () => res({ data: { ok: true } }) }))
    )
    const p = useMessagingStore.getState().sendMessage('conv_001', 'test')
    expect(useMessagingStore.getState().sendLoading).toBe(true)
    resolve()
    await p
    expect(useMessagingStore.getState().sendLoading).toBe(false)
  })

  it('sets sendError and does NOT rethrow on failure (fix: was syntax error)', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Conversation not found')))
    )
    // The fixed sendMessage should set sendError but NOT throw
    await useMessagingStore.getState().sendMessage('conv_bad', 'hello')
    expect(useMessagingStore.getState().sendError).toBe('Conversation not found')
    expect(useMessagingStore.getState().sendLoading).toBe(false)
  })

  it('sets Arabic fallback sendError for unknown failure', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject('unknown'))
    )
    await useMessagingStore.getState().sendMessage('conv_001', 'test')
    expect(useMessagingStore.getState().sendError).toBe('فشل إرسال الرسالة')
  })

  it('sendLoading is always false after failure (no duplicate finally)', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('err')))
    )
    await useMessagingStore.getState().sendMessage('conv_001', 'test')
    expect(useMessagingStore.getState().sendLoading).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §4  openConversation
// ─────────────────────────────────────────────────────────────────────────────

describe('messagingStore — openConversation', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('returns conversationId and sets activeConvId on success', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { ok: true, conversationId: 'conv_001' } }))
    )
    const id = await useMessagingStore.getState().openConversation('ord_001')
    expect(id).toBe('conv_001')
    expect(useMessagingStore.getState().activeConvId).toBe('conv_001')
  })

  it('resolves without throwing on failure (non-critical)', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Order not found')))
    )
    await expect(
      useMessagingStore.getState().openConversation('ord_missing')
    ).resolves.toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §5  subscribeConversations / unsubscribeAll
// ─────────────────────────────────────────────────────────────────────────────

describe('messagingStore — subscribeConversations', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('sets convsLoading=true when subscribing', () => {
    useMessagingStore.getState().subscribeConversations('user_001')
    expect(useMessagingStore.getState().convsLoading).toBe(true)
  })

  it('stores a combined unsubscribe fn', () => {
    const mockUnsub = jest.fn()
    firestoreMocks().onSnapshot.mockReturnValue(mockUnsub)
    useMessagingStore.getState().subscribeConversations('user_001')
    expect(useMessagingStore.getState()._unsubConvs).toBeInstanceOf(Function)
  })

  it('calls previous unsub before re-subscribing', () => {
    const prevUnsub = jest.fn()
    useMessagingStore.setState({ _unsubConvs: prevUnsub })
    useMessagingStore.getState().subscribeConversations('user_001')
    expect(prevUnsub).toHaveBeenCalled()
  })
})

describe('messagingStore — unsubscribeAll', () => {
  beforeEach(resetStore)

  it('calls all unsubscribe functions and clears state', () => {
    const unsubConvs    = jest.fn()
    const unsubMessages = jest.fn()
    const timer = setTimeout(() => {}, 99999)
    useMessagingStore.setState({
      _unsubConvs: unsubConvs, _unsubMessages: unsubMessages,
      _typingTimer: timer, activeConvId: 'conv_001',
      messages: [makeMessage()], typingUsers: { uid1: true },
    })
    useMessagingStore.getState().unsubscribeAll()
    expect(unsubConvs).toHaveBeenCalled()
    expect(unsubMessages).toHaveBeenCalled()
    const s = useMessagingStore.getState()
    expect(s._unsubConvs).toBeNull()
    expect(s._unsubMessages).toBeNull()
    expect(s._typingTimer).toBeNull()
    expect(s.activeConvId).toBeNull()
    expect(s.messages).toEqual([])
    expect(s.typingUsers).toEqual({})
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §6  markRead
// ─────────────────────────────────────────────────────────────────────────────

describe('messagingStore — markRead', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('resolves without throwing on success', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { ok: true, markedCount: 3 } }))
    )
    await expect(
      useMessagingStore.getState().markRead('conv_001')
    ).resolves.toBeUndefined()
  })

  it('resolves without throwing on failure (non-critical)', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Network error')))
    )
    await expect(
      useMessagingStore.getState().markRead('conv_001')
    ).resolves.toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §7  sendTyping — TTL-based (no double-write)
// ─────────────────────────────────────────────────────────────────────────────

describe('messagingStore — sendTyping', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
    firestoreMocks().updateDoc.mockResolvedValue(undefined)
  })

  it('sets typingUsers[uid]=true and writes expiresAt when isTyping=true', async () => {
    await useMessagingStore.getState().sendTyping('conv_001', 'uid_001', true)
    expect(useMessagingStore.getState().typingUsers['uid_001']).toBe(true)
    expect(firestoreMocks().updateDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({ 'typingExpiresAt.uid_001': expect.any(Number) }),
    )
  })

  it('sets typingUsers[uid]=false and writes 0 when isTyping=false', async () => {
    useMessagingStore.setState({ typingUsers: { uid_001: true } })
    await useMessagingStore.getState().sendTyping('conv_001', 'uid_001', false)
    expect(useMessagingStore.getState().typingUsers['uid_001']).toBe(false)
    expect(firestoreMocks().updateDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({ 'typingExpiresAt.uid_001': 0 }),
    )
  })

  it('writes only ONE Firestore update (not two) per call — TTL design', async () => {
    await useMessagingStore.getState().sendTyping('conv_001', 'uid_002', true)
    // Only 1 updateDoc call per isTyping=true (no separate "stop typing" write)
    expect(firestoreMocks().updateDoc).toHaveBeenCalledTimes(1)
  })

  it('resolves without throwing when updateDoc fails (non-critical)', async () => {
    firestoreMocks().updateDoc.mockRejectedValueOnce(new Error('Offline'))
    await expect(
      useMessagingStore.getState().sendTyping('conv_001', 'uid_001', true)
    ).resolves.toBeUndefined()
  })
})
