import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'order-1' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/ordersStore', () => ({
  useOrdersStore: jest.fn(() => ({
    activeOrder: null,
    activeQuotes: [],
    orderLoading: false,
    actionLoading: false,
    loadOrderDetail: jest.fn(),
    acceptQuote: jest.fn(() => Promise.resolve()),
    confirmCompletion: jest.fn(() => Promise.resolve()),
    cancelOrder: jest.fn(() => Promise.resolve()),
    markComplete: jest.fn(() => Promise.resolve()),
    clearError: jest.fn(),
  })),
}))
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'cust-1' }, isCustomer: true, isProvider: false }),
}))
jest.mock('../../lib/analytics', () => ({
  Analytics: { orderViewed: jest.fn(), quoteAccepted: jest.fn() },
}))
jest.mock('@workfix/utils', () => ({
  formatDate:           jest.fn(() => '1 يناير 2025'),
  formatPrice:          jest.fn((v: number) => `${v} ر.س`),
  getOrderStatusLabel:  jest.fn(() => 'Pending'),
}))
jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
}))
jest.mock('../../lib/firebase', () => ({
  firebaseFunctions: {},
}))

import OrderDetailScreen from '../../screens/orders/OrderDetailScreen'

describe('OrderDetailScreen — Smoke Test', () => {
  it('renders without crashing when no order loaded', () => {
    expect(() => render(<OrderDetailScreen />)).not.toThrow()
  })

  it('renders loading state', () => {
    const { useOrdersStore } = require('../../stores/ordersStore')
    ;(useOrdersStore as jest.Mock).mockReturnValueOnce({
      activeOrder: null,
      activeQuotes: [],
      orderLoading: true,
      actionLoading: false,
      loadOrderDetail: jest.fn(),
      acceptQuote: jest.fn(),
      confirmCompletion: jest.fn(),
      cancelOrder: jest.fn(),
      markComplete: jest.fn(),
      clearError: jest.fn(),
    })
    expect(() => render(<OrderDetailScreen />)).not.toThrow()
  })

  it('renders with a loaded order', () => {
    const { useOrdersStore } = require('../../stores/ordersStore')
    ;(useOrdersStore as jest.Mock).mockReturnValueOnce({
      activeOrder: {
        id: 'order-1', status: 'pending',
        customerId: 'cust-1', providerId: null,
        description: 'Fix AC', categoryId: 'cat-1',
        createdAt: new Date(), scheduledAt: null,
        location: { lat: 24.7, lng: 46.7, city: 'الرياض' },
        photos: [], totalAmount: 0,
      },
      activeQuotes: [],
      orderLoading: false,
      actionLoading: false,
      loadOrderDetail: jest.fn(),
      acceptQuote: jest.fn(),
      confirmCompletion: jest.fn(),
      cancelOrder: jest.fn(),
      markComplete: jest.fn(),
      clearError: jest.fn(),
    })
    expect(() => render(<OrderDetailScreen />)).not.toThrow()
  })
})
