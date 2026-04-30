import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'order-1', providerName: 'Ahmed', customerName: 'Sara' }),
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}))
jest.mock('../../stores/messagingStore', () => ({
  useMessagingStore: jest.fn(() => ({
    messages: [], messagesLoading: false, sendingMessage: false,
    typingUsers: {}, conversation: null,
    subscribeMessages: jest.fn(), unsubscribeMessages: jest.fn(),
    sendMessage: jest.fn(), markMessagesRead: jest.fn(),
    setTyping: jest.fn(),
  })),
}))
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}))
jest.mock('../../hooks/useImageUpload', () => ({
  useImageUpload: jest.fn(() => ({ upload: jest.fn(), uploading: false, error: null })),
}))
jest.mock('@workfix/utils', () => ({ formatDate: jest.fn(() => 'today') }))

import ChatScreen from '../../screens/chat/ChatScreen'

describe('ChatScreen — Smoke Test', () => {
  it('renders without crashing', () => {
    expect(() => render(<ChatScreen />)).not.toThrow()
  })
})
