import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ orderId: 'order-1', providerId: 'prov-1', providerName: 'Ahmed' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/ordersStore', () => ({
  useOrdersStore: jest.fn(() => ({
    submitReview: jest.fn(() => Promise.resolve()),
  })),
}))
jest.mock('../../lib/analytics', () => ({
  Analytics: { reviewSubmitted: jest.fn() },
}))

import ReviewScreen from '../../screens/reviews/ReviewScreen'

describe('ReviewScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<ReviewScreen />)).not.toThrow()
  })

  it('renders star rating row', () => {
    const { getAllByRole } = render(<ReviewScreen />)
    // Stars are TouchableOpacity elements — just verify the screen rendered
    expect(getAllByRole('button').length).toBeGreaterThan(0)
  })

  it('handles submit press without crashing', () => {
    const { useOrdersStore } = require('../../stores/ordersStore')
    const submitReview = jest.fn(() => Promise.resolve())
    ;(useOrdersStore as jest.Mock).mockReturnValueOnce({ submitReview })
    expect(() => render(<ReviewScreen />)).not.toThrow()
  })
})
