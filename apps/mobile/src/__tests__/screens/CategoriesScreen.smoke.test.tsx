import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/marketplaceStore', () => ({
  useMarketplaceStore: jest.fn(() => ({
    categories: [], categoriesLoading: false, loadCategories: jest.fn(),
  })),
}))

import CategoriesScreen from '../../screens/home/CategoriesScreen'

describe('CategoriesScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<CategoriesScreen />)).not.toThrow()
  })
})
