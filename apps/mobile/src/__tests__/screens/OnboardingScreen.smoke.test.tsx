import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))

import OnboardingScreen from '../../screens/auth/OnboardingScreen'

describe('OnboardingScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<OnboardingScreen />)).not.toThrow()
  })
})
