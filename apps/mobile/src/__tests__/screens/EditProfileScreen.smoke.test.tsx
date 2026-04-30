import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../hooks/useImageUpload', () => ({
  useImageUpload: jest.fn(() => ({
    upload: jest.fn(), uploading: false, error: null,
  })),
}))

import EditProfileScreen from '../../screens/profile/EditProfileScreen'

describe('EditProfileScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<EditProfileScreen />)).not.toThrow()
  })
})
