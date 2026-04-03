import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    signInEmail: jest.fn(), sendPhoneOtp: jest.fn(),
    isLoading: false, error: null, clearError: jest.fn(),
  })),
}))
jest.mock('../../lib/analytics', () => ({
  Analytics: { login: jest.fn(), signUpStart: jest.fn() },
}))

import LoginScreen from '../../screens/auth/LoginScreen'

describe('LoginScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<LoginScreen />)).not.toThrow()
  })
})
