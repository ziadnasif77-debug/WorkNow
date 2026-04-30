import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ category: '', query: '' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/marketplaceStore', () => ({
  useMarketplaceStore: jest.fn(() => ({
    providers: [], searchLoading: false, searchError: null,
    categories: [], searchTotal: 0, hasMore: false,
    searchProviders: jest.fn(), loadCategories: jest.fn(),
  })),
}))
jest.mock('../../hooks/useLocation', () => ({
  useLocation: () => ({ lat: 24.7, lng: 46.7, city: 'الرياض', isLoading: false, error: null }),
}))

import SearchScreen from '../../screens/home/SearchScreen'

describe('SearchScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<SearchScreen />)).not.toThrow()
  })
})
