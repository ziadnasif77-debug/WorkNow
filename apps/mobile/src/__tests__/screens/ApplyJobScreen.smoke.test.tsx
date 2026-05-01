import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'job-1', title: 'Engineer' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/jobsStore', () => ({
  useJobsStore: jest.fn(() => ({
    applyToJob: jest.fn(), actionLoading: false, actionError: null,
  })),
}))
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    firebaseUser: { uid: 'u1', displayName: 'Ahmed', email: 'a@b.com' },
  })),
}))

import ApplyJobScreen from '../../screens/jobs/ApplyJobScreen'

describe('ApplyJobScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<ApplyJobScreen />)).not.toThrow()
  })
})
