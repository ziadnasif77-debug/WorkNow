import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'job-1' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/jobsStore', () => ({
  useJobsStore: jest.fn(() => ({
    activeJob: null, jobLoading: false, loadJobDetail: jest.fn(),
  })),
}))

import JobDetailScreen from '../../screens/jobs/JobDetailScreen'

describe('JobDetailScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<JobDetailScreen />)).not.toThrow()
  })
})
