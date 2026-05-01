import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/ordersStore', () => ({
  useOrdersStore: jest.fn(() => ({
    incomingOrders: [], incomingLoading: false,
    subscribeIncomingOrders: jest.fn(), unsubscribeAll: jest.fn(),
  })),
}))
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'prov-1' }, isCustomer: false, isProvider: true }),
}))
jest.mock('@workfix/utils', () => ({
  formatDate: jest.fn(() => 'today'), formatPrice: jest.fn(() => '100'),
  getOrderStatusLabel: jest.fn(() => 'New'),
}))

import ProviderDashboardScreen from '../../screens/provider-dashboard/ProviderDashboardScreen'

describe('ProviderDashboardScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<ProviderDashboardScreen />)).not.toThrow()
  })
})
