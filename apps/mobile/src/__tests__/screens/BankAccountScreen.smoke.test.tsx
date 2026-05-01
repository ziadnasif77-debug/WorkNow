import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/paymentsStore', () => ({
  usePaymentsStore: jest.fn(() => ({
    saveBankAccount: jest.fn(), isLoading: false, error: null,
  })),
}))

import BankAccountScreen from '../../screens/profile/BankAccountScreen'

describe('BankAccountScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<BankAccountScreen />)).not.toThrow()
  })
})
