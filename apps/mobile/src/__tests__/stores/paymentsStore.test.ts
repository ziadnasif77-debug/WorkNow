// ─────────────────────────────────────────────────────────────────────────────
// paymentsStore — unit tests
// Global firebase mocks provided by jest.setup.js
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('firebase/functions', () => ({
  getFunctions:             jest.fn(),
  httpsCallable:            jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
  connectFunctionsEmulator: jest.fn(),
}))

jest.mock('firebase/firestore', () => ({
  getFirestore:                jest.fn(),
  doc:                         jest.fn(() => 'doc-ref'),
  updateDoc:                   jest.fn(() => Promise.resolve()),
  connectFirestoreEmulator:    jest.fn(),
  enableIndexedDbPersistence:  jest.fn(() => Promise.resolve()),
  persistentLocalCache:        jest.fn(),
  persistentMultipleTabManager: jest.fn(),
  memoryLocalCache:            jest.fn(),
  CACHE_SIZE_UNLIMITED:        -1,
}))

// ── imports ───────────────────────────────────────────────────────────────────
import { usePaymentsStore } from '../../stores/paymentsStore'

// ── helpers ───────────────────────────────────────────────────────────────────
function callable() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('firebase/functions') as { httpsCallable: jest.Mock }
}

const resetStore = () =>
  usePaymentsStore.setState({
    isInitiating:  false,
    initError:     null,
    redirectUrl:   null,
    tapChargeId:   null,
    wallet:        null,
    walletLoading: false,
    payoutLoading: false,
    payoutError:   null,
    lastPayoutId:  null,
  })

// ─────────────────────────────────────────────────────────────────────────────
// §1  Initial state
// ─────────────────────────────────────────────────────────────────────────────

describe('paymentsStore — initial state', () => {
  beforeEach(resetStore)

  it('starts with no redirect URL or charge ID', () => {
    const s = usePaymentsStore.getState()
    expect(s.redirectUrl).toBeNull()
    expect(s.tapChargeId).toBeNull()
  })

  it('starts with null wallet', () => {
    expect(usePaymentsStore.getState().wallet).toBeNull()
  })

  it('starts with all loading flags false', () => {
    const s = usePaymentsStore.getState()
    expect(s.isInitiating).toBe(false)
    expect(s.walletLoading).toBe(false)
    expect(s.payoutLoading).toBe(false)
  })

  it('starts with no errors', () => {
    const s = usePaymentsStore.getState()
    expect(s.initError).toBeNull()
    expect(s.payoutError).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §2  clearErrors / reset
// ─────────────────────────────────────────────────────────────────────────────

describe('paymentsStore — clearErrors & reset', () => {
  beforeEach(resetStore)

  it('clearErrors nullifies initError and payoutError', () => {
    usePaymentsStore.setState({ initError: 'خطأ', payoutError: 'خطأ سحب' })
    usePaymentsStore.getState().clearErrors()
    expect(usePaymentsStore.getState().initError).toBeNull()
    expect(usePaymentsStore.getState().payoutError).toBeNull()
  })

  it('reset clears redirectUrl, tapChargeId, and initError', () => {
    usePaymentsStore.setState({
      redirectUrl: 'https://tap.company/pay', tapChargeId: 'chg_001', initError: 'err',
    })
    usePaymentsStore.getState().reset()
    const s = usePaymentsStore.getState()
    expect(s.redirectUrl).toBeNull()
    expect(s.tapChargeId).toBeNull()
    expect(s.initError).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §3  initiatePayment
// ─────────────────────────────────────────────────────────────────────────────

describe('paymentsStore — initiatePayment', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('returns redirectUrl on card payment success', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({
        data: { ok: true, tapChargeId: 'chg_001', redirectUrl: 'https://tap.company/pay/chg_001' },
      }))
    )
    const url = await usePaymentsStore.getState().initiatePayment('ord_001', 'card')
    expect(url).toBe('https://tap.company/pay/chg_001')
    expect(usePaymentsStore.getState().tapChargeId).toBe('chg_001')
    expect(usePaymentsStore.getState().redirectUrl).toBe('https://tap.company/pay/chg_001')
  })

  it('returns "cash" for cash payment without redirect', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { ok: true } }))
    )
    const result = await usePaymentsStore.getState().initiatePayment('ord_001', 'cash')
    expect(result).toBe('cash')
  })

  it('sets isInitiating=true during call, false after', async () => {
    let resolve!: () => void
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => new Promise<{ data: object }>(res => { resolve = () => res({ data: { ok: true } }) }))
    )
    const p = usePaymentsStore.getState().initiatePayment('ord_001', 'card')
    expect(usePaymentsStore.getState().isInitiating).toBe(true)
    resolve()
    await p.catch(() => {})
    expect(usePaymentsStore.getState().isInitiating).toBe(false)
  })

  it('sets initError and rethrows on failure', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Card declined')))
    )
    await expect(
      usePaymentsStore.getState().initiatePayment('ord_001', 'card')
    ).rejects.toThrow('Card declined')
    expect(usePaymentsStore.getState().initError).toBe('Card declined')
  })

  it('sets initError for unknown failure', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject('boom'))
    )
    await expect(
      usePaymentsStore.getState().initiatePayment('ord_001', 'stc_pay')
    ).rejects.toBeTruthy()
    expect(usePaymentsStore.getState().initError).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §4  loadWallet
// ─────────────────────────────────────────────────────────────────────────────

describe('paymentsStore — loadWallet', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('populates wallet on success', async () => {
    const walletData = {
      ok: true,
      availableBalance: 308,
      pendingBalance: 0,
      processingPayouts: 0,
      currency: 'SAR' as const,
    }
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: walletData }))
    )
    await usePaymentsStore.getState().loadWallet()
    expect(usePaymentsStore.getState().wallet).toMatchObject({
      availableBalance: 308,
      currency: 'SAR',
    })
  })

  it('sets walletLoading=true during call, false after', async () => {
    let resolve!: () => void
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => new Promise<{ data: object }>(res => { resolve = () => res({ data: {} }) }))
    )
    const p = usePaymentsStore.getState().loadWallet()
    expect(usePaymentsStore.getState().walletLoading).toBe(true)
    resolve()
    await p
    expect(usePaymentsStore.getState().walletLoading).toBe(false)
  })

  it('resolves without throwing on failure (silent error)', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Network error')))
    )
    await expect(usePaymentsStore.getState().loadWallet()).resolves.toBeUndefined()
    expect(usePaymentsStore.getState().walletLoading).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §5  requestPayout
// ─────────────────────────────────────────────────────────────────────────────

describe('paymentsStore — requestPayout', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('sets lastPayoutId and refreshes wallet on success', async () => {
    callable().httpsCallable
      .mockReturnValueOnce(
        jest.fn(() => Promise.resolve({ data: { ok: true, payoutId: 'payout_001', amount: 200 } }))
      )
      .mockReturnValueOnce(
        jest.fn(() => Promise.resolve({
          data: { ok: true, availableBalance: 108, pendingBalance: 200, processingPayouts: 200, currency: 'SAR' },
        }))
      )
    await usePaymentsStore.getState().requestPayout(200)
    expect(usePaymentsStore.getState().lastPayoutId).toBe('payout_001')
    expect(usePaymentsStore.getState().wallet?.availableBalance).toBe(108)
  })

  it('sets payoutLoading=true during call, false after', async () => {
    let resolve!: () => void
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => new Promise<{ data: object }>(res => { resolve = () => res({ data: { ok: true, payoutId: 'p1', amount: 50 } }) }))
    )
    const p = usePaymentsStore.getState().requestPayout(50)
    expect(usePaymentsStore.getState().payoutLoading).toBe(true)
    resolve()
    await p.catch(() => {})
    expect(usePaymentsStore.getState().payoutLoading).toBe(false)
  })

  it('sets payoutError and rethrows on failure', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Insufficient balance')))
    )
    await expect(usePaymentsStore.getState().requestPayout(999)).rejects.toThrow()
    expect(usePaymentsStore.getState().payoutError).toBe('Insufficient balance')
  })

  it('works without explicit amount (full payout)', async () => {
    callable().httpsCallable
      .mockReturnValueOnce(
        jest.fn(() => Promise.resolve({ data: { ok: true, payoutId: 'payout_full', amount: 308 } }))
      )
      .mockReturnValueOnce(
        jest.fn(() => Promise.resolve({ data: { ok: true, availableBalance: 0, pendingBalance: 308, processingPayouts: 308, currency: 'SAR' } }))
      )
    await usePaymentsStore.getState().requestPayout()
    expect(usePaymentsStore.getState().lastPayoutId).toBe('payout_full')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §6  createSubscription
// ─────────────────────────────────────────────────────────────────────────────

describe('paymentsStore — createSubscription', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('returns redirectUrl on success', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({
        data: { ok: true, redirectUrl: 'https://tap.company/sub/001' },
      }))
    )
    const result = await usePaymentsStore.getState().createSubscription('pro', 'monthly')
    expect(result.redirectUrl).toBe('https://tap.company/sub/001')
  })

  it('sets initError and rethrows on failure', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Payment gateway error')))
    )
    await expect(
      usePaymentsStore.getState().createSubscription('pro', 'monthly')
    ).rejects.toThrow()
    expect(usePaymentsStore.getState().initError).toBeTruthy()
  })

  it('returns undefined redirectUrl when not included in response', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { ok: true } }))
    )
    const result = await usePaymentsStore.getState().createSubscription('free', 'monthly')
    expect(result.redirectUrl).toBeUndefined()
  })
})
