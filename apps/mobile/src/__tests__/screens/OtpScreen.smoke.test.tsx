import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ phone: '+966500000000' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    confirmPhoneOtp: jest.fn(), sendPhoneOtp: jest.fn(),
    isLoading: false, error: null, clearError: jest.fn(),
  })),
}))

import OtpScreen from '../../screens/auth/OtpScreen'

describe('OtpScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<OtpScreen />)).not.toThrow()
  })
})
