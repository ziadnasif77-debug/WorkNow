import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))

import ChangePasswordScreen from '../../screens/profile/ChangePasswordScreen'

describe('ChangePasswordScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<ChangePasswordScreen />)).not.toThrow()
  })
})
