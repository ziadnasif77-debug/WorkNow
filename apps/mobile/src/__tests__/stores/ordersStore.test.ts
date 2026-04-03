// ─────────────────────────────────────────────────────────────────────────────
// ordersStore — unit tests
// Firebase mocks are provided globally by jest.setup.js
// ─────────────────────────────────────────────────────────────────────────────

// Override httpsCallable per-test via require()
jest.mock('firebase/functions', () => ({
  getFunctions:  jest.fn(),
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
  connectFunctionsEmulator: jest.fn(),
}))

jest.mock('firebase/firestore', () => ({
  getFirestore:   jest.fn(),
  collection:     jest.fn(() => 'col-ref'),
  query:          jest.fn(() => 'query-ref'),
  where:          jest.fn(),
  orderBy:        jest.fn(),
  limit:          jest.fn(),
  doc:            jest.fn(() => 'doc-ref'),
  onSnapshot:     jest.fn(() => jest.fn()),   // returns unsubscribe fn
  getDocs:        jest.fn(() => Promise.resolve({ docs: [] })),
  getDoc:         jest.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  updateDoc:      jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => new Date()),
  enableIndexedDbPersistence:   jest.fn(() => Promise.resolve()),
  connectFirestoreEmulator:     jest.fn(),
  persistentLocalCache:         jest.fn(),
  persistentMultipleTabManager: jest.fn(),
  memoryLocalCache:             jest.fn(),
  CACHE_SIZE_UNLIMITED:         -1,
}))

// ── imports ───────────────────────────────────────────────────────────────────
import { useOrdersStore } from '../../stores/ordersStore'

// ── helpers ───────────────────────────────────────────────────────────────────

function httpsCallableMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('firebase/functions') as { httpsCallable: jest.Mock }
}

const resetStore = () =>
  useOrdersStore.setState({
    myOrders:        [],
    ordersLoading:   false,
    incomingOrders:  [],
    incomingLoading: false,
    activeOrder:     null,
    activeQuotes:    [],
    orderLoading:    false,
    actionLoading:   false,
    actionError:     null,
    _unsubOrders:    null,
    _unsubIncoming:  null,
    _unsubDetail:    null,
  })

// ─────────────────────────────────────────────────────────────────────────────
// §1  Initial state
// ─────────────────────────────────────────────────────────────────────────────

describe('ordersStore — initial state', () => {
  beforeEach(resetStore)

  it('starts with empty order lists', () => {
    const s = useOrdersStore.getState()
    expect(s.myOrders).toEqual([])
    expect(s.incomingOrders).toEqual([])
  })

  it('starts with no active order', () => {
    expect(useOrdersStore.getState().activeOrder).toBeNull()
    expect(useOrdersStore.getState().activeQuotes).toEqual([])
  })

  it('starts with all loading flags false', () => {
    const s = useOrdersStore.getState()
    expect(s.ordersLoading).toBe(false)
    expect(s.incomingLoading).toBe(false)
    expect(s.orderLoading).toBe(false)
    expect(s.actionLoading).toBe(false)
  })

  it('starts with no error', () => {
    expect(useOrdersStore.getState().actionError).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §2  clearError
// ─────────────────────────────────────────────────────────────────────────────

describe('ordersStore — clearError', () => {
  beforeEach(resetStore)

  it('clears actionError to null', () => {
    useOrdersStore.setState({ actionError: 'فشل إنشاء الطلب' })
    useOrdersStore.getState().clearError()
    expect(useOrdersStore.getState().actionError).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §3  createOrder
// ─────────────────────────────────────────────────────────────────────────────

describe('ordersStore — createOrder', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('returns orderId on success', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { ok: true, orderId: 'ord_new_001' } }))
    )
    const orderId = await useOrdersStore.getState().createOrder({
      serviceId: 'svc_001', categoryId: 'cat_001',
      description: 'Install AC', currency: 'SAR',
      location: { latitude: 24.7, longitude: 46.7 }, address: 'الرياض',
      attachmentUrls: [], isScheduled: false,
    } as never)
    expect(orderId).toBe('ord_new_001')
  })

  it('sets actionLoading=true during call, false after', async () => {
    let resolveCall!: () => void
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => new Promise<{ data: { ok: boolean; orderId: string } }>(res => {
        resolveCall = () => res({ data: { ok: true, orderId: 'x' } })
      }))
    )
    const p = useOrdersStore.getState().createOrder({} as never)
    expect(useOrdersStore.getState().actionLoading).toBe(true)
    resolveCall()
    await p
    expect(useOrdersStore.getState().actionLoading).toBe(false)
  })

  it('sets actionError and rethrows on failure', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Network error')))
    )
    await expect(
      useOrdersStore.getState().createOrder({} as never)
    ).rejects.toThrow('Network error')
    expect(useOrdersStore.getState().actionError).toBe('Network error')
    expect(useOrdersStore.getState().actionLoading).toBe(false)
  })

  it('sets fallback Arabic error when error has no message', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject('unknown'))
    )
    await expect(
      useOrdersStore.getState().createOrder({} as never)
    ).rejects.toBeTruthy()
    expect(useOrdersStore.getState().actionError).toBe('فشل إنشاء الطلب')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §4  submitQuote
// ─────────────────────────────────────────────────────────────────────────────

describe('ordersStore — submitQuote', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('resolves without error on success', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { ok: true } }))
    )
    await expect(
      useOrdersStore.getState().submitQuote({
        orderId: 'ord_001', price: 350, currency: 'SAR',
        estimatedDurationMinutes: 120,
      } as never)
    ).resolves.toBeUndefined()
  })

  it('actionLoading is false after success', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { ok: true } }))
    )
    await useOrdersStore.getState().submitQuote({} as never)
    expect(useOrdersStore.getState().actionLoading).toBe(false)
  })

  it('sets actionError and rethrows on failure', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('فشل إرسال العرض')))
    )
    await expect(
      useOrdersStore.getState().submitQuote({} as never)
    ).rejects.toThrow()
    expect(useOrdersStore.getState().actionError).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §5  acceptQuote
// ─────────────────────────────────────────────────────────────────────────────

describe('ordersStore — acceptQuote', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('returns paymentRequired when backend includes it', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({
        data: {
          ok: true,
          paymentRequired: { amount: 350, currency: 'SAR', orderId: 'ord_001' },
        },
      }))
    )
    const result = await useOrdersStore.getState().acceptQuote({
      orderId: 'ord_001', quoteId: 'qte_001',
    } as never)
    expect(result).toEqual({ amount: 350, currency: 'SAR', orderId: 'ord_001' })
  })

  it('returns null when no paymentRequired in response', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { ok: true } }))
    )
    const result = await useOrdersStore.getState().acceptQuote({} as never)
    expect(result).toBeNull()
  })

  it('sets actionLoading false after success', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { ok: true } }))
    )
    await useOrdersStore.getState().acceptQuote({} as never)
    expect(useOrdersStore.getState().actionLoading).toBe(false)
  })

  it('sets actionError and rethrows on failure', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Quote expired')))
    )
    await expect(
      useOrdersStore.getState().acceptQuote({} as never)
    ).rejects.toThrow('Quote expired')
    expect(useOrdersStore.getState().actionError).toBe('Quote expired')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §6  confirmCompletion
// ─────────────────────────────────────────────────────────────────────────────

describe('ordersStore — confirmCompletion', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('resolves on success', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { ok: true } }))
    )
    await expect(
      useOrdersStore.getState().confirmCompletion('ord_001')
    ).resolves.toBeUndefined()
    expect(useOrdersStore.getState().actionLoading).toBe(false)
  })

  it('sets error on failure', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Order not in progress')))
    )
    await expect(
      useOrdersStore.getState().confirmCompletion('ord_001')
    ).rejects.toThrow()
    expect(useOrdersStore.getState().actionError).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §7  cancelOrder
// ─────────────────────────────────────────────────────────────────────────────

describe('ordersStore — cancelOrder', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('resolves on success', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { ok: true } }))
    )
    await expect(
      useOrdersStore.getState().cancelOrder({ orderId: 'ord_001', reason: 'changed_mind' } as never)
    ).resolves.toBeUndefined()
  })

  it('sets fallback Arabic error on unknown failure', async () => {
    httpsCallableMock().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject('boom'))
    )
    await expect(
      useOrdersStore.getState().cancelOrder({} as never)
    ).rejects.toBeTruthy()
    expect(useOrdersStore.getState().actionError).toBe('فشل الإلغاء')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §8  subscribeMyOrders / unsubscribeAll
// ─────────────────────────────────────────────────────────────────────────────

describe('ordersStore — subscriptions', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('subscribeMyOrders sets ordersLoading=true initially', () => {
    // onSnapshot is mocked to return a jest.fn() (unsubscribe)
    useOrdersStore.getState().subscribeMyOrders('cust_001')
    expect(useOrdersStore.getState().ordersLoading).toBe(true)
  })

  it('subscribeMyOrders stores unsubscribe fn', () => {
    const mockUnsub = jest.fn()
    const { onSnapshot } = require('firebase/firestore') as { onSnapshot: jest.Mock }
    onSnapshot.mockReturnValueOnce(mockUnsub)
    useOrdersStore.getState().subscribeMyOrders('cust_001')
    expect(useOrdersStore.getState()._unsubOrders).toBe(mockUnsub)
  })

  it('unsubscribeAll nullifies all subscriptions', () => {
    const mockFn = jest.fn()
    useOrdersStore.setState({
      _unsubOrders: mockFn, _unsubIncoming: mockFn, _unsubDetail: mockFn,
    })
    useOrdersStore.getState().unsubscribeAll()
    expect(mockFn).toHaveBeenCalledTimes(3)
    const s = useOrdersStore.getState()
    expect(s._unsubOrders).toBeNull()
    expect(s._unsubIncoming).toBeNull()
    expect(s._unsubDetail).toBeNull()
  })

  it('unsubscribeDetail clears activeOrder and activeQuotes', () => {
    useOrdersStore.setState({
      _unsubDetail: jest.fn(),
      activeOrder:  { id: 'ord_001' } as never,
      activeQuotes: [{ id: 'q1' }] as never,
    })
    useOrdersStore.getState().unsubscribeDetail()
    expect(useOrdersStore.getState().activeOrder).toBeNull()
    expect(useOrdersStore.getState().activeQuotes).toEqual([])
    expect(useOrdersStore.getState()._unsubDetail).toBeNull()
  })
})
