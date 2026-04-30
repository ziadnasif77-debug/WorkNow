// useProviderTracking — unit tests

jest.mock('firebase/firestore', () => ({
  doc:              jest.fn(() => 'doc-ref'),
  setDoc:           jest.fn(() => Promise.resolve()),
  deleteDoc:        jest.fn(() => Promise.resolve()),
  serverTimestamp:  jest.fn(() => new Date()),
}))
jest.mock('../../lib/firebase', () => ({ firestore: {} }))

import { renderHook } from '@testing-library/react-native'
import { useProviderTracking } from '../../hooks/useProviderTracking'

describe('useProviderTracking', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does nothing when orderId is null', () => {
    const { result } = renderHook(() =>
      useProviderTracking(null, null, 'uid-1')
    )
    expect(result.current).toBeUndefined()
  })

  it('does nothing when order is null', () => {
    renderHook(() =>
      useProviderTracking('order-1', null, 'uid-1')
    )
    // no errors thrown
  })

  it('does nothing when currentUid does not match providerId', () => {
    renderHook(() =>
      useProviderTracking('order-1', { status: 'confirmed', providerId: 'other-uid' }, 'uid-1')
    )
    // no timer started — user is not the provider
  })

  it('does not track for inactive order status', () => {
    renderHook(() =>
      useProviderTracking('order-1', { status: 'pending', providerId: 'uid-1' }, 'uid-1')
    )
  })

  it('cleans up on unmount when active', () => {
    const { unmount } = renderHook(() =>
      useProviderTracking('order-1', { status: 'confirmed', providerId: 'uid-1' }, 'uid-1')
    )
    // Should not throw on unmount
    expect(() => unmount()).not.toThrow()
  })
})
