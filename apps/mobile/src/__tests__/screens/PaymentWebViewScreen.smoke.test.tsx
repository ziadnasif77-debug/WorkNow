import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ url: 'https://checkout.example.com', orderId: 'order-1' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))

import PaymentWebViewScreen from '../../screens/payments/PaymentWebViewScreen'

describe('PaymentWebViewScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<PaymentWebViewScreen />)).not.toThrow()
  })
})
