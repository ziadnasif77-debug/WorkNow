import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    signUpEmail: jest.fn(), completeProfile: jest.fn(),
    isLoading: false, error: null, clearError: jest.fn(),
  })),
}))
jest.mock('@workfix/utils', () => ({ isValidEmail: jest.fn(() => true), isValidPassword: jest.fn(() => true) }))

import RegisterScreen from '../../screens/auth/RegisterScreen'

describe('RegisterScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<RegisterScreen />)).not.toThrow()
  })
})
