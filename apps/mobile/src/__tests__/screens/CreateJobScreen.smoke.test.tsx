import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/jobsStore', () => ({
  useJobsStore: jest.fn(() => ({
    createJob: jest.fn(), actionLoading: false, actionError: null,
  })),
}))

import CreateJobScreen from '../../screens/jobs/CreateJobScreen'

describe('CreateJobScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<CreateJobScreen />)).not.toThrow()
  })
})
