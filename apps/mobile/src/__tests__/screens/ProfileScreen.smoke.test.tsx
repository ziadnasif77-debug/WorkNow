import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('../../lib/i18n', () => ({ changeLanguage: jest.fn(), default: { language: 'ar' } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar', changeLanguage: jest.fn() } }),
}))
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'u1', displayName: 'Ahmed', email: 'a@b.com', photoURL: null },
    role: 'customer', isCustomer: true, isProvider: false, signOut: jest.fn(),
  }),
}))
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    firebaseUser: { uid: 'u1', displayName: 'Ahmed' },
    role: 'customer', signOut: jest.fn(),
  })),
}))

import ProfileScreen from '../../screens/profile/ProfileScreen'

describe('ProfileScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<ProfileScreen />)).not.toThrow()
  })
})
