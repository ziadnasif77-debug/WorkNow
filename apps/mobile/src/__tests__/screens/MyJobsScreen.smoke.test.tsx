import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/jobsStore', () => ({
  useJobsStore: jest.fn(() => ({
    myJobs: [], myJobsLoading: false,
    subscribeMyJobs: jest.fn(), unsubscribeAll: jest.fn(),
    updateJobStatus: jest.fn(), actionLoading: false,
  })),
}))
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({ firebaseUser: { uid: 'prov-1' } })),
}))

import MyJobsScreen from '../../screens/jobs/MyJobsScreen'

describe('MyJobsScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<MyJobsScreen />)).not.toThrow()
  })
})
