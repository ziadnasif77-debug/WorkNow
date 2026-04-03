// ─────────────────────────────────────────────────────────────────────────────
// marketplaceStore — unit tests
// Global firebase mocks provided by jest.setup.js
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('firebase/functions', () => ({
  getFunctions:             jest.fn(),
  httpsCallable:            jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
  connectFunctionsEmulator: jest.fn(),
}))

jest.mock('firebase/firestore', () => ({
  getFirestore:                jest.fn(),
  collection:                  jest.fn(() => 'col-ref'),
  query:                       jest.fn(() => 'query-ref'),
  where:                       jest.fn(),
  orderBy:                     jest.fn(),
  getDocs:                     jest.fn(() => Promise.resolve({ docs: [] })),
  connectFirestoreEmulator:    jest.fn(),
  enableIndexedDbPersistence:  jest.fn(() => Promise.resolve()),
  persistentLocalCache:        jest.fn(),
  persistentMultipleTabManager: jest.fn(),
  memoryLocalCache:            jest.fn(),
  CACHE_SIZE_UNLIMITED:        -1,
}))

// ── imports ───────────────────────────────────────────────────────────────────
import { useMarketplaceStore } from '../../stores/marketplaceStore'

// ── helpers ───────────────────────────────────────────────────────────────────
function callable() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('firebase/functions') as { httpsCallable: jest.Mock }
}

function firestoreMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('firebase/firestore') as { getDocs: jest.Mock }
}

const SAMPLE_PROVIDERS = [
  { id: 'p1', avgRating: 4.9, distanceKm: 1.2, kycStatus: 'approved' },
  { id: 'p2', avgRating: 4.5, distanceKm: 2.8, kycStatus: 'approved' },
]

const SAMPLE_CATEGORIES = [
  { id: 'cat_001', name: { ar: 'سباكة', en: 'Plumbing' }, isActive: true, sortOrder: 1 },
  { id: 'cat_002', name: { ar: 'كهرباء', en: 'Electrical' }, isActive: true, sortOrder: 2 },
]

const resetStore = () =>
  useMarketplaceStore.setState({
    categories:        [],
    categoriesLoading: false,
    providers:         [],
    searchLoading:     false,
    searchError:       null,
    searchTotal:       0,
    hasMore:           false,
    lastQuery:         null,
    _searchAbort:      null,
    selectedProvider:  null,
    profileLoading:    false,
  })

// ─────────────────────────────────────────────────────────────────────────────
// §1  Initial state
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplaceStore — initial state', () => {
  beforeEach(resetStore)

  it('starts with empty categories and providers', () => {
    const s = useMarketplaceStore.getState()
    expect(s.categories).toEqual([])
    expect(s.providers).toEqual([])
  })

  it('starts with all loading flags false', () => {
    const s = useMarketplaceStore.getState()
    expect(s.categoriesLoading).toBe(false)
    expect(s.searchLoading).toBe(false)
    expect(s.profileLoading).toBe(false)
  })

  it('starts with null selectedProvider and no search error', () => {
    const s = useMarketplaceStore.getState()
    expect(s.selectedProvider).toBeNull()
    expect(s.searchError).toBeNull()
  })

  it('_searchAbort starts null (fix: was missing from initial state)', () => {
    expect(useMarketplaceStore.getState()._searchAbort).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §2  loadCategories
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplaceStore — loadCategories', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('populates categories from Firestore', async () => {
    firestoreMock().getDocs.mockResolvedValueOnce({
      docs: SAMPLE_CATEGORIES.map(c => ({
        id:   c.id,
        data: () => c,
      })),
    })
    await useMarketplaceStore.getState().loadCategories()
    expect(useMarketplaceStore.getState().categories).toHaveLength(2)
    expect(useMarketplaceStore.getState().categories[0]!.id).toBe('cat_001')
  })

  it('sorts categories by sortOrder', async () => {
    firestoreMock().getDocs.mockResolvedValueOnce({
      docs: [
        { id: 'cat_002', data: () => ({ ...SAMPLE_CATEGORIES[1], sortOrder: 2 }) },
        { id: 'cat_001', data: () => ({ ...SAMPLE_CATEGORIES[0], sortOrder: 1 }) },
      ],
    })
    await useMarketplaceStore.getState().loadCategories()
    expect(useMarketplaceStore.getState().categories[0]!.id).toBe('cat_001')
    expect(useMarketplaceStore.getState().categories[1]!.id).toBe('cat_002')
  })

  it('does not re-fetch when categories already loaded', async () => {
    useMarketplaceStore.setState({ categories: SAMPLE_CATEGORIES as never })
    await useMarketplaceStore.getState().loadCategories()
    expect(firestoreMock().getDocs).not.toHaveBeenCalled()
  })

  it('sets categoriesLoading=true during call, false after', async () => {
    let resolve!: () => void
    firestoreMock().getDocs.mockReturnValueOnce(
      new Promise(res => { resolve = () => res({ docs: [] }) })
    )
    const p = useMarketplaceStore.getState().loadCategories()
    expect(useMarketplaceStore.getState().categoriesLoading).toBe(true)
    resolve()
    await p
    expect(useMarketplaceStore.getState().categoriesLoading).toBe(false)
  })

  it('resolves without throwing on failure (silent error)', async () => {
    firestoreMock().getDocs.mockRejectedValueOnce(new Error('Firestore error'))
    await expect(useMarketplaceStore.getState().loadCategories()).resolves.toBeUndefined()
    expect(useMarketplaceStore.getState().categoriesLoading).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §3  searchProviders
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplaceStore — searchProviders', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  const SEARCH_PAYLOAD = {
    categoryId: 'cat_001',
    location:   { latitude: 24.7, longitude: 46.7 },
    radiusKm:   10,
  } as never

  it('populates providers list on success', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({
        data: { providers: SAMPLE_PROVIDERS, total: 2, hasMore: false },
      }))
    )
    await useMarketplaceStore.getState().searchProviders(SEARCH_PAYLOAD)
    expect(useMarketplaceStore.getState().providers).toHaveLength(2)
    expect(useMarketplaceStore.getState().searchTotal).toBe(2)
    expect(useMarketplaceStore.getState().hasMore).toBe(false)
  })

  it('sets hasMore=true when backend indicates more results', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({
        data: { providers: SAMPLE_PROVIDERS, total: 50, hasMore: true },
      }))
    )
    await useMarketplaceStore.getState().searchProviders(SEARCH_PAYLOAD)
    expect(useMarketplaceStore.getState().hasMore).toBe(true)
  })

  it('stores lastQuery for loadMore', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({ data: { providers: [], total: 0, hasMore: false } }))
    )
    await useMarketplaceStore.getState().searchProviders(SEARCH_PAYLOAD)
    expect(useMarketplaceStore.getState().lastQuery).toMatchObject({ categoryId: 'cat_001' })
  })

  it('sets searchLoading=true during call, false after', async () => {
    let resolve!: () => void
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => new Promise<{ data: object }>(res => { resolve = () => res({ data: { providers: [], total: 0, hasMore: false } }) }))
    )
    const p = useMarketplaceStore.getState().searchProviders(SEARCH_PAYLOAD)
    expect(useMarketplaceStore.getState().searchLoading).toBe(true)
    resolve()
    await p
    expect(useMarketplaceStore.getState().searchLoading).toBe(false)
  })

  it('sets Arabic searchError on failure', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Network timeout')))
    )
    await useMarketplaceStore.getState().searchProviders(SEARCH_PAYLOAD)
    expect(useMarketplaceStore.getState().searchError).toBe('فشل البحث. تحقق من اتصالك.')
    expect(useMarketplaceStore.getState().searchLoading).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §4  loadMore
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplaceStore — loadMore', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('appends providers to existing list', async () => {
    useMarketplaceStore.setState({
      providers:   SAMPLE_PROVIDERS as never,
      hasMore:     true,
      lastQuery:   { categoryId: 'cat_001' } as never,
      searchLoading: false,
    })
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({
        data: {
          providers: [{ id: 'p3', avgRating: 4.2, distanceKm: 5.0 }],
          hasMore: false,
        },
      }))
    )
    await useMarketplaceStore.getState().loadMore()
    expect(useMarketplaceStore.getState().providers).toHaveLength(3)
    expect(useMarketplaceStore.getState().hasMore).toBe(false)
  })

  it('does nothing when hasMore=false', async () => {
    useMarketplaceStore.setState({ hasMore: false, lastQuery: {} as never })
    await useMarketplaceStore.getState().loadMore()
    expect(callable().httpsCallable).not.toHaveBeenCalled()
  })

  it('does nothing when already loading', async () => {
    useMarketplaceStore.setState({ hasMore: true, searchLoading: true, lastQuery: {} as never })
    await useMarketplaceStore.getState().loadMore()
    expect(callable().httpsCallable).not.toHaveBeenCalled()
  })

  it('does nothing when no lastQuery', async () => {
    useMarketplaceStore.setState({ hasMore: true, searchLoading: false, lastQuery: null })
    await useMarketplaceStore.getState().loadMore()
    expect(callable().httpsCallable).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §5  getProviderProfile
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplaceStore — getProviderProfile', () => {
  beforeEach(() => {
    resetStore()
    jest.clearAllMocks()
  })

  it('populates selectedProvider on success', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.resolve({
        data: {
          profile: { id: 'p1', avgRating: 4.9, kycStatus: 'approved' },
          user:    { displayName: 'Mohammed', avatarUrl: null },
          reviews: [{ rating: 5 }],
        },
      }))
    )
    await useMarketplaceStore.getState().getProviderProfile('p1')
    const provider = useMarketplaceStore.getState().selectedProvider
    expect(provider).not.toBeNull()
    expect(provider!.id).toBe('p1')
    expect(provider!.displayName).toBe('Mohammed')
    expect((provider as never as { reviews: unknown[] }).reviews).toHaveLength(1)
  })

  it('sets profileLoading=true during call, false after', async () => {
    let resolve!: () => void
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => new Promise<{ data: object }>(res => {
        resolve = () => res({ data: { profile: {}, user: {}, reviews: [] } })
      }))
    )
    const p = useMarketplaceStore.getState().getProviderProfile('p1')
    expect(useMarketplaceStore.getState().profileLoading).toBe(true)
    resolve()
    await p
    expect(useMarketplaceStore.getState().profileLoading).toBe(false)
  })

  it('clears selectedProvider at start of each call', async () => {
    useMarketplaceStore.setState({ selectedProvider: { id: 'old' } as never })
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Not found')))
    )
    await useMarketplaceStore.getState().getProviderProfile('p_missing')
    expect(useMarketplaceStore.getState().selectedProvider).toBeNull()
  })

  it('resolves without throwing on failure (silent)', async () => {
    callable().httpsCallable.mockReturnValueOnce(
      jest.fn(() => Promise.reject(new Error('Permission denied')))
    )
    await expect(
      useMarketplaceStore.getState().getProviderProfile('p_err')
    ).resolves.toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §6  clearSearch
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplaceStore — clearSearch', () => {
  it('resets providers, total, hasMore, and lastQuery', () => {
    useMarketplaceStore.setState({
      providers:   SAMPLE_PROVIDERS as never,
      searchTotal: 2,
      hasMore:     true,
      lastQuery:   { categoryId: 'cat_001' } as never,
    })
    useMarketplaceStore.getState().clearSearch()
    const s = useMarketplaceStore.getState()
    expect(s.providers).toEqual([])
    expect(s.searchTotal).toBe(0)
    expect(s.hasMore).toBe(false)
    expect(s.lastQuery).toBeNull()
  })
})
