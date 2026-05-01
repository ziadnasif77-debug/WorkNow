// useNotifications — unit tests

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))
jest.mock('../../stores/notificationsStore', () => ({
  useNotificationsStore: jest.fn(),
}))
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(),
}))

import { renderHook } from '@testing-library/react-native'
import { useNotifications } from '../../hooks/useNotifications'
import { useNotificationsStore } from '../../stores/notificationsStore'
import { useAuthStore }          from '../../stores/authStore'

const mockNotifStore = useNotificationsStore as jest.Mock
const mockAuthStore  = useAuthStore          as jest.Mock

const mockFns = {
  registerToken:          jest.fn(() => Promise.resolve()),
  subscribeNotifications: jest.fn(),
  getRouteForNotif:       jest.fn(() => null),
  unsubscribe:            jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  mockNotifStore.mockReturnValue(mockFns)
  mockAuthStore.mockReturnValue({ firebaseUser: { uid: 'u1' } })
  // reset each fn so calls are fresh
  Object.values(mockFns).forEach(fn => fn.mockClear())
})

describe('useNotifications', () => {
  it('does nothing when user is not logged in', () => {
    mockAuthStore.mockReturnValue({ firebaseUser: null })
    renderHook(() => useNotifications())
    expect(mockFns.registerToken).not.toHaveBeenCalled()
  })

  it('registers token when user is logged in', () => {
    renderHook(() => useNotifications())
    expect(mockFns.registerToken).toHaveBeenCalledTimes(1)
  })

  it('subscribes to notifications for the logged-in uid', () => {
    renderHook(() => useNotifications())
    expect(mockFns.subscribeNotifications).toHaveBeenCalledWith('u1')
  })

  it('unsubscribes and removes listeners on unmount', () => {
    const { unmount } = renderHook(() => useNotifications())
    unmount()
    expect(mockFns.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
