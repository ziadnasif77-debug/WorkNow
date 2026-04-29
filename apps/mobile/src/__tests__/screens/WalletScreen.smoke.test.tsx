import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/paymentsStore', () => ({
  usePaymentsStore: jest.fn(() => ({
    wallet: null,
    walletLoading: false,
    walletError: null,
    payoutLoading: false,
    payoutError: null,
    loadWallet: jest.fn(),
    requestPayout: jest.fn(() => Promise.resolve()),
    clearErrors: jest.fn(),
    clearWalletError: jest.fn(),
  })),
}))
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'test-uid' }, isProvider: true }),
}))
jest.mock('@workfix/utils', () => ({
  formatPrice: jest.fn((v: number) => `${v} ر.س`),
}))

import WalletScreen from '../../screens/payments/WalletScreen'

describe('WalletScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<WalletScreen />)).not.toThrow()
  })

  it('renders loading state when walletLoading is true', () => {
    const { usePaymentsStore } = require('../../stores/paymentsStore')
    ;(usePaymentsStore as jest.Mock).mockReturnValueOnce({
      wallet: null,
      walletLoading: true,
      walletError: null,
      payoutLoading: false,
      payoutError: null,
      loadWallet: jest.fn(),
      requestPayout: jest.fn(),
      clearErrors: jest.fn(),
      clearWalletError: jest.fn(),
    })
    expect(() => render(<WalletScreen />)).not.toThrow()
  })

  it('renders wallet data when loaded', () => {
    const { usePaymentsStore } = require('../../stores/paymentsStore')
    ;(usePaymentsStore as jest.Mock).mockReturnValueOnce({
      wallet: { balance: 500, pending: 100, totalEarned: 2000 },
      walletLoading: false,
      walletError: null,
      payoutLoading: false,
      payoutError: null,
      loadWallet: jest.fn(),
      requestPayout: jest.fn(),
      clearErrors: jest.fn(),
      clearWalletError: jest.fn(),
    })
    expect(() => render(<WalletScreen />)).not.toThrow()
  })
})
