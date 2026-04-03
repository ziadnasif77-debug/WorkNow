import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    firebaseUser: { uid: 'test-uid', displayName: 'Test User' },
    role: 'customer',
  })),
}))
jest.mock('../../stores/marketplaceStore', () => ({
  useMarketplaceStore: jest.fn(() => ({
    categories: [], providers: [],
    categoriesLoading: false, searchLoading: false,
    loadCategories: jest.fn(), searchProviders: jest.fn(),
  })),
}))
jest.mock('../../hooks/useLocation', () => ({
  useLocation: () => ({ lat: 24.7, lng: 46.7, city: 'الرياض', isLoading: false }),
}))
jest.mock('../../lib/analytics', () => ({
  Analytics: { providerSearch: jest.fn(), categorySelected: jest.fn() },
}))

import HomeScreen from '../../screens/home/HomeScreen'

describe('HomeScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<HomeScreen />)).not.toThrow()
  })
})
