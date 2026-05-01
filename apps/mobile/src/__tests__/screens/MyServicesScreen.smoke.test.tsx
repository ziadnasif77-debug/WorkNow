import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('@workfix/utils', () => ({ formatPrice: jest.fn((a) => String(a)) }))
jest.mock('../../../screens/jobs/MyJobsScreen', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { default: () => React.createElement(View) }
}, { virtual: true })
jest.mock('../../screens/jobs/MyJobsScreen', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { default: () => React.createElement(View) }
})

import MyServicesScreen from '../../screens/profile/MyServicesScreen'

describe('MyServicesScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<MyServicesScreen />)).not.toThrow()
  })
})
