import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/notificationsStore', () => ({
  useNotificationsStore: jest.fn(() => ({
    notifications: [], loading: false,
    subscribeNotifications: jest.fn(), markAllRead: jest.fn(), unsubscribeAll: jest.fn(),
  })),
}))
jest.mock('@workfix/utils', () => ({ formatDate: jest.fn(() => 'today') }))

import NotificationsScreen from '../../screens/notifications/NotificationsScreen'

describe('NotificationsScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<NotificationsScreen />)).not.toThrow()
  })
})
