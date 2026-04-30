import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'prov-1' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/marketplaceStore', () => ({
  useMarketplaceStore: jest.fn(() => ({
    selectedProvider: null, profileLoading: false, getProviderProfile: jest.fn(),
  })),
}))
jest.mock('@workfix/utils', () => ({ formatDate: jest.fn(() => 'today'), formatPrice: jest.fn((a) => String(a)) }))

import ProviderProfileScreen from '../../screens/provider/ProviderProfileScreen'

describe('ProviderProfileScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<ProviderProfileScreen />)).not.toThrow()
  })
})
