// ─────────────────────────────────────────────────────────────────────────────
// Marketplace Store — providers search + categories + provider profile
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { httpsCallable } from 'firebase/functions'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firebaseFunctions, firestore } from '../lib/firebase'
import type {
  ProviderProfile, Category, SearchProvidersPayload,
  SearchProvidersResult,
} from '@workfix/types'

interface ProviderWithDistance extends ProviderProfile {
  distanceKm: number
  displayName?: string
  avatarUrl?:  string
}

interface MarketplaceState {
  // Categories
  categories:         Category[]
  categoriesLoading:  boolean

  // Search results
  providers:          ProviderWithDistance[]
  searchLoading:      boolean
  searchError:        string | null
  searchTotal:        number
  hasMore:            boolean
  lastQuery:          Partial<SearchProvidersPayload> | null
  _searchAbort:       AbortController | null

  // Selected provider
  selectedProvider:   (ProviderProfile & { displayName?: string; avatarUrl?: string; reviews?: unknown[] }) | null
  profileLoading:     boolean

  // Actions
  loadCategories:     () => Promise<void>
  searchProviders:    (payload: SearchProvidersPayload) => Promise<void>
  loadMore:           () => Promise<void>
  getProviderProfile: (providerId: string) => Promise<void>
  clearSearch:        () => void
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
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

  // ── loadCategories ─────────────────────────────────────────────────────────
  loadCategories: async () => {
    if (get().categories.length > 0) return   // already loaded
    set({ categoriesLoading: true })
    try {
      const q = query(
        collection(firestore, 'categories'),
        where('isActive', '==', true),
      )
      const snap = await getDocs(q)
      const cats = snap.docs
        .map(d => ({ ...d.data(), id: d.id } as Category))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      set({ categories: cats })
    } catch (err) {
      console.error('Failed to load categories', err)
    } finally {
      set({ categoriesLoading: false })
    }
  },

  // ── searchProviders ────────────────────────────────────────────────────────
  searchProviders: async payload => {
    // Cancel any in-flight search
    get()._searchAbort?.abort()
    const controller = new AbortController()
    set({ searchLoading: true, searchError: null, lastQuery: payload, _searchAbort: controller })
    try {
      const fn = httpsCallable<SearchProvidersPayload, SearchProvidersResult>(
        firebaseFunctions, 'searchProviders',
      )
      const res = await fn({ ...payload, page: 0 })
      set({
        providers:  res.data.providers as ProviderWithDistance[],
        searchTotal: res.data.total,
        hasMore:    res.data.hasMore,
      })
    } catch (err) {
      set({ searchError: 'فشل البحث. تحقق من اتصالك.' })
    } finally {
      set({ searchLoading: false })
    }
  },

  // ── loadMore ───────────────────────────────────────────────────────────────
  loadMore: async () => {
    const { lastQuery, providers, hasMore, searchLoading } = get()
    if (!hasMore || searchLoading || !lastQuery) return

    set({ searchLoading: true })
    try {
      const fn = httpsCallable<SearchProvidersPayload, SearchProvidersResult>(
        firebaseFunctions, 'searchProviders',
      )
      const page = Math.floor(providers.length / (lastQuery.limit ?? 20))
      const res  = await fn({ ...lastQuery, page } as SearchProvidersPayload)
      set(s => ({
        providers: [...s.providers, ...(res.data.providers as ProviderWithDistance[])],
        hasMore:   res.data.hasMore,
      }))
    } finally {
      set({ searchLoading: false })
    }
  },

  // ── getProviderProfile ────────────────────────────────────────────────────
  getProviderProfile: async providerId => {
    set({ profileLoading: true, selectedProvider: null })
    try {
      const fn = httpsCallable(firebaseFunctions, 'getProviderProfile')
      const res = await fn({ providerId })
      const d   = res.data as { profile: ProviderProfile; user: { displayName?: string; avatarUrl?: string }; reviews: unknown[] }
      set({
        selectedProvider: {
          ...d.profile,
          displayName: d.user.displayName,
          avatarUrl:   d.user.avatarUrl,
          reviews:     d.reviews,
        },
      })
    } catch {
      // silently fails — screen handles null state
    } finally {
      set({ profileLoading: false })
    }
  },

  clearSearch: () => set({ providers: [], searchTotal: 0, hasMore: false, lastQuery: null }),
}))
