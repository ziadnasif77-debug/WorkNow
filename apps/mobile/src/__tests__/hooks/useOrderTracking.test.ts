// ─────────────────────────────────────────────────────────────────────────────
// useOrderTracking — unit tests
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('firebase/firestore', () => ({
  doc:        jest.fn(() => 'doc-ref'),
  onSnapshot: jest.fn(),
}))
jest.mock('../../lib/firebase', () => ({ firestore: {} }))

import { renderHook, act } from '@testing-library/react-native'
import { useOrderTracking } from '../../hooks/useOrderTracking'
import { onSnapshot } from 'firebase/firestore'

const mockUnsub = jest.fn()
const mockOnSnapshot = onSnapshot as jest.Mock

describe('useOrderTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOnSnapshot.mockReturnValue(mockUnsub)
  })

  it('returns null when orderId is null', () => {
    const { result } = renderHook(() => useOrderTracking(null))
    expect(result.current).toBeNull()
    expect(mockOnSnapshot).not.toHaveBeenCalled()
  })

  it('subscribes to Firestore when orderId is provided', () => {
    renderHook(() => useOrderTracking('order-1'))
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)
  })

  it('returns null when snapshot does not exist', () => {
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ exists: () => false })
      return mockUnsub
    })
    const { result } = renderHook(() => useOrderTracking('order-1'))
    expect(result.current).toBeNull()
  })

  it('returns location data when snapshot exists', () => {
    const mockDate = { toDate: () => new Date('2025-01-01') }
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({
        exists: () => true,
        data: () => ({ lat: 24.7, lng: 46.7, heading: 90, accuracy: 5, updatedAt: mockDate }),
      })
      return mockUnsub
    })
    const { result } = renderHook(() => useOrderTracking('order-1'))
    expect(result.current).toMatchObject({ lat: 24.7, lng: 46.7, heading: 90 })
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useOrderTracking('order-1'))
    unmount()
    expect(mockUnsub).toHaveBeenCalledTimes(1)
  })

  it('resets to null when orderId changes to null', () => {
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ exists: () => true, data: () => ({ lat: 24.7, lng: 46.7, heading: null, accuracy: null, updatedAt: null }) })
      return mockUnsub
    })
    const { result, rerender } = renderHook(({ id }) => useOrderTracking(id), {
      initialProps: { id: 'order-1' as string | null },
    })
    expect(result.current).not.toBeNull()
    act(() => rerender({ id: null }))
    expect(result.current).toBeNull()
  })
})
