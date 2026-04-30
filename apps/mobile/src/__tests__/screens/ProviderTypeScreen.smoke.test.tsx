import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), back: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    setProviderType: jest.fn(), isLoading: false, error: null, clearError: jest.fn(),
  })),
}))
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
}))

import ProviderTypeScreen from '../../screens/auth/ProviderTypeScreen'

describe('ProviderTypeScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<ProviderTypeScreen />)).not.toThrow()
  })
})
