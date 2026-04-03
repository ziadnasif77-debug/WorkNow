// ─────────────────────────────────────────────────────────────────────────────
// useNetworkState — real-time online/offline detection
// Subscription is correctly cleaned up to avoid memory leaks
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import NetInfo from '@react-native-community/netinfo'
import type { NetInfoState } from '@react-native-community/netinfo'

export interface NetworkState {
  isConnected:         boolean
  isInternetReachable: boolean | null
}

export function useNetworkState(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected:         true,
    isInternetReachable: true,
  })

  const handleChange = useCallback((s: NetInfoState) => {
    setState({
      isConnected:         s.isConnected ?? true,
      isInternetReachable: s.isInternetReachable,
    })
  }, [])

  useEffect(() => {
    // Fetch initial state immediately (don't wait for first event)
    void NetInfo.fetch().then(handleChange)

    // Subscribe to subsequent changes
    const unsubscribe = NetInfo.addEventListener(handleChange)

    // Cleanup on unmount — prevents stale state updates
    return () => unsubscribe()
  }, [handleChange])

  return state
}

/** Simpler boolean-only variant for components that just need isConnected */
export function useIsOnline(): boolean {
  const { isConnected } = useNetworkState()
  return isConnected
}
