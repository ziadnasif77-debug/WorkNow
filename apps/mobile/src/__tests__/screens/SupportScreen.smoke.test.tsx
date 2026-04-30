import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ page: 'faq' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../hooks/useNetworkState', () => ({ useIsOnline: () => true }))

import SupportScreen from '../../screens/support/SupportScreen'

describe('SupportScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<SupportScreen />)).not.toThrow()
  })
})
