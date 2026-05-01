import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useLocalSearchParams: () => ({ orderId: 'order-1', amount: '100', currency: 'SAR' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))

import PaymentSuccessScreen from '../../screens/payments/PaymentSuccessScreen'

describe('PaymentSuccessScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<PaymentSuccessScreen />)).not.toThrow()
  })
})
