import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/jobsStore', () => ({
  useJobsStore: jest.fn(() => ({
    myApplications: [], applicationsLoading: false, loadMyApplications: jest.fn(),
  })),
}))
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({ firebaseUser: { uid: 'u1' } })),
}))

import MyApplicationsScreen from '../../screens/jobs/MyApplicationsScreen'

describe('MyApplicationsScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<MyApplicationsScreen />)).not.toThrow()
  })
})
