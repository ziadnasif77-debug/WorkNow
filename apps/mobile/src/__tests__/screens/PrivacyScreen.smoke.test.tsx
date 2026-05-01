import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, isLoggedIn: true }),
}))

import PrivacyScreen from '../../screens/profile/PrivacyScreen'

describe('PrivacyScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<PrivacyScreen />)).not.toThrow()
  })
})
