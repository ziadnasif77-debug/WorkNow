import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ orderId: 'order-1' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/ordersStore', () => ({
  useOrdersStore: jest.fn(() => ({
    openDispute: jest.fn(), actionLoading: false, actionError: null,
  })),
}))
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
}))

import DisputeScreen from '../../screens/disputes/DisputeScreen'

describe('DisputeScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<DisputeScreen />)).not.toThrow()
  })
})
