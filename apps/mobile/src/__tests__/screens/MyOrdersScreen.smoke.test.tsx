import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/ordersStore', () => ({
  useOrdersStore: jest.fn(() => ({
    myOrders: [], ordersLoading: false,
    subscribeMyOrders: jest.fn(), unsubscribeAll: jest.fn(),
  })),
}))
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, isCustomer: true, isProvider: false }),
}))
jest.mock('@workfix/utils', () => ({
  formatDate: jest.fn(() => 'today'), formatPrice: jest.fn(() => '100'),
  getOrderStatusLabel: jest.fn(() => 'Pending'),
}))

import MyOrdersScreen from '../../screens/orders/MyOrdersScreen'

describe('MyOrdersScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<MyOrdersScreen />)).not.toThrow()
  })
  it('renders loading state', () => {
    const { useOrdersStore } = require('../../stores/ordersStore')
    ;(useOrdersStore as jest.Mock).mockReturnValueOnce({
      myOrders: [], ordersLoading: true,
      subscribeMyOrders: jest.fn(), unsubscribeAll: jest.fn(),
    })
    expect(() => render(<MyOrdersScreen />)).not.toThrow()
  })
})
