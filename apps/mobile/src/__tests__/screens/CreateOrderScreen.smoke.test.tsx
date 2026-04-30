import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ providerId: 'prov-1', serviceId: 'svc-1' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/ordersStore', () => ({
  useOrdersStore: jest.fn(() => ({
    createOrder: jest.fn(() => Promise.resolve('order-1')),
    actionLoading: false, actionError: null, clearErrors: jest.fn(),
  })),
}))
jest.mock('../../hooks/useNetworkState', () => ({ useIsOnline: () => true }))
jest.mock('../../hooks/useLocation', () => ({
  useLocation: () => ({ lat: 24.7, lng: 46.7, city: 'الرياض', country: 'SA', isLoading: false }),
}))
jest.mock('../../components/MapLocationPicker', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { MapLocationPicker: () => React.createElement(View) }
})
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
}))
jest.mock('@workfix/utils', () => ({ formatDate: jest.fn(() => 'today') }))

import CreateOrderScreen from '../../screens/orders/CreateOrderScreen'

describe('CreateOrderScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<CreateOrderScreen />)).not.toThrow()
  })
})
