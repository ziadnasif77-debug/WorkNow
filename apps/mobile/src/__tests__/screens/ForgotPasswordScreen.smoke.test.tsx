import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('@workfix/utils', () => ({ isValidEmail: jest.fn(() => true) }))

import ForgotPasswordScreen from '../../screens/auth/ForgotPasswordScreen'

describe('ForgotPasswordScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<ForgotPasswordScreen />)).not.toThrow()
  })
})
