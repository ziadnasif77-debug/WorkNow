import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('@workfix/utils', () => ({ formatPrice: jest.fn((a) => String(a)) }))

import ProviderStatsScreen from '../../screens/profile/ProviderStatsScreen'

describe('ProviderStatsScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<ProviderStatsScreen />)).not.toThrow()
  })
})
