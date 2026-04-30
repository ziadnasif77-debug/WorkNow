import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ orderId: 'order-1', amount: '100', currency: 'SAR' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/paymentsStore', () => ({
  usePaymentsStore: jest.fn(() => ({
    initiatePayment: jest.fn(() => Promise.resolve(null)),
    isInitiating: false, initError: null, clearErrors: jest.fn(),
  })),
}))
jest.mock('../../hooks/useNetworkState', () => ({ useIsOnline: () => true }))
jest.mock('../../hooks/useLocation', () => ({
  useLocation: () => ({ lat: 24.7, lng: 46.7, city: 'الرياض', country: 'SA', isLoading: false }),
}))
jest.mock('@workfix/utils', () => ({ formatPrice: jest.fn((a) => String(a)) }))

import PaymentScreen from '../../screens/payments/PaymentScreen'

describe('PaymentScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<PaymentScreen />)).not.toThrow()
  })
})
