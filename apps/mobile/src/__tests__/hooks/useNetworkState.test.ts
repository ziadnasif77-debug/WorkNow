// useNetworkState — unit tests

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch:            jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
    addEventListener: jest.fn(() => jest.fn()),
    configure:        jest.fn(),
  },
}))

import { renderHook, waitFor } from '@testing-library/react-native'
import { useNetworkState, useIsOnline } from '../../hooks/useNetworkState'
import NetInfo from '@react-native-community/netinfo'

const mockFetch            = NetInfo.fetch            as jest.Mock
const mockAddEventListener = NetInfo.addEventListener as jest.Mock

const ONLINE  = { isConnected: true,  isInternetReachable: true  }
const OFFLINE = { isConnected: false, isInternetReachable: false }

describe('useNetworkState', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue(ONLINE)
    mockAddEventListener.mockReturnValue(jest.fn())
  })

  it('starts with isConnected=true by default', () => {
    const { result } = renderHook(() => useNetworkState())
    expect(result.current.isConnected).toBe(true)
  })

  it('updates to online after fetch resolves', async () => {
    mockFetch.mockResolvedValue(ONLINE)
    const { result } = renderHook(() => useNetworkState())
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(result.current.isConnected).toBe(true)
  })

  it('updates to offline when fetch resolves offline', async () => {
    mockFetch.mockResolvedValue(OFFLINE)
    const { result } = renderHook(() => useNetworkState())
    await waitFor(() => expect(result.current.isConnected).toBe(false))
  })

  it('calls addEventListener to subscribe', () => {
    renderHook(() => useNetworkState())
    expect(mockAddEventListener).toHaveBeenCalled()
  })

  it('cleans up listener on unmount', () => {
    const mockUnsub = jest.fn()
    mockAddEventListener.mockReturnValue(mockUnsub)
    const { unmount } = renderHook(() => useNetworkState())
    unmount()
    expect(mockUnsub).toHaveBeenCalled()
  })
})

describe('useIsOnline', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue(ONLINE)
    mockAddEventListener.mockReturnValue(jest.fn())
  })

  it('returns true when online', async () => {
    const { result } = renderHook(() => useIsOnline())
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('returns false when offline', async () => {
    mockFetch.mockResolvedValue(OFFLINE)
    const { result } = renderHook(() => useIsOnline())
    await waitFor(() => expect(result.current).toBe(false))
  })
})
