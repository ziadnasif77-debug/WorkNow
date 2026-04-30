// useAuth — thin wrapper around useAuthStore
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    firebaseUser: { uid: 'u1', displayName: 'Ahmed', email: 'a@b.com', photoURL: null },
    role: 'customer',
    isLoading: false,
    isInitialized: true,
    signOut: jest.fn(),
    error: null,
    clearError: jest.fn(),
  })),
}))

import { renderHook } from '@testing-library/react-native'
import { useAuth } from '../../hooks/useAuth'

describe('useAuth', () => {
  it('returns derived state from useAuthStore', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.user?.uid).toBe('u1')
    expect(result.current.isLoggedIn).toBe(true)
    expect(result.current.isCustomer).toBe(true)
    expect(result.current.isProvider).toBe(false)
  })

  it('returns isAdmin false for customer role', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.isAdmin).toBe(false)
  })
})
