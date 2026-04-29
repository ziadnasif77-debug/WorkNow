import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/messagingStore', () => ({
  useMessagingStore: jest.fn(() => ({
    conversations: [],
    convsLoading: false,
    subscribeConversations: jest.fn(),
    unsubscribeAll: jest.fn(),
  })),
}))
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'test-uid' }, isCustomer: true, isProvider: false }),
}))
jest.mock('@workfix/utils', () => ({
  formatDate: jest.fn(() => 'اليوم'),
  formatPrice: jest.fn(() => '100 ر.س'),
}))

import ConversationsScreen from '../../screens/chat/ConversationsScreen'

describe('ConversationsScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<ConversationsScreen />)).not.toThrow()
  })

  it('renders loading skeletons when convsLoading is true', () => {
    const { useMessagingStore } = require('../../stores/messagingStore')
    ;(useMessagingStore as jest.Mock).mockReturnValueOnce({
      conversations: [],
      convsLoading: true,
      subscribeConversations: jest.fn(),
      unsubscribeAll: jest.fn(),
    })
    expect(() => render(<ConversationsScreen />)).not.toThrow()
  })

  it('renders empty state when no conversations', () => {
    expect(() => render(<ConversationsScreen />)).not.toThrow()
  })
})
