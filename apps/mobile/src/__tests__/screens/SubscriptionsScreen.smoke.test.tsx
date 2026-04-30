import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))

const mockStoreState = {
  createSubscription: jest.fn(() => Promise.resolve()),
  isLoading: false, error: null,
}
jest.mock('../../stores/paymentsStore', () => {
  const mock = jest.fn(() => mockStoreState)
  mock.getState = jest.fn(() => mockStoreState)
  return { usePaymentsStore: mock }
})

import SubscriptionsScreen from '../../screens/subscriptions/SubscriptionsScreen'

describe('SubscriptionsScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<SubscriptionsScreen />)).not.toThrow()
  })
})
