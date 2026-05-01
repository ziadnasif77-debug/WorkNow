// ─────────────────────────────────────────────────────────────────────────────
// useLocation — unit tests
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getForegroundPermissionsAsync:     jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: { latitude: 24.7136, longitude: 46.6753, accuracy: 10, heading: null, speed: null },
  })),
  reverseGeocodeAsync: jest.fn(() => Promise.resolve([{ city: 'Riyadh', isoCountryCode: 'SA' }])),
  Accuracy: { Balanced: 3 },
}))

import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useLocation } from '../../hooks/useLocation'

describe('useLocation', () => {
  beforeEach(() => jest.clearAllMocks())

  it('starts with isLoading=true and null coords', () => {
    const { result } = renderHook(() => useLocation())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.lat).toBeNull()
    expect(result.current.lng).toBeNull()
  })

  it('populates lat/lng after permission granted', async () => {
    const { result } = renderHook(() => useLocation())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.lat).toBeCloseTo(24.7136)
    expect(result.current.lng).toBeCloseTo(46.6753)
  })

  it('falls back to defaults when permission denied', async () => {
    const Location = require('expo-location')
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' })
    const { result } = renderHook(() => useLocation())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.lat).toBe(24.7136)
    expect(result.current.lng).toBe(46.6753)
  })

  it('falls back to defaults when location fetch throws', async () => {
    const Location = require('expo-location')
    Location.getCurrentPositionAsync.mockRejectedValueOnce(new Error('GPS unavailable'))
    const { result } = renderHook(() => useLocation())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.lat).toBe(24.7136)
    expect(result.current.error).toBeTruthy()
  })

  it('setManual updates lat/lng', async () => {
    const { result } = renderHook(() => useLocation())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => { result.current.setManual(25.0, 47.0) })
    expect(result.current.lat).toBe(25.0)
    expect(result.current.lng).toBe(47.0)
  })

  it('refresh re-fetches location', async () => {
    const Location = require('expo-location')
    const { result } = renderHook(() => useLocation())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    Location.getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { latitude: 25.1, longitude: 47.2, accuracy: 5, heading: null, speed: null },
    })
    await act(async () => { await result.current.refresh() })
    expect(result.current.lat).toBeCloseTo(25.1)
  })
})
