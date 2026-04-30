import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'job-1' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/jobsStore', () => ({
  useJobsStore: jest.fn(() => ({
    jobApplications: [], jobApplicationsLoading: false,
    loadJobApplications: jest.fn(), updateApplicationStatus: jest.fn(),
  })),
}))

import JobApplicationsScreen from '../../screens/jobs/JobApplicationsScreen'

describe('JobApplicationsScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<JobApplicationsScreen />)).not.toThrow()
  })
})
