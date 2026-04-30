// ─────────────────────────────────────────────────────────────────────────────
// useProviderTracking — provider side
// Publishes GPS location to Firestore every INTERVAL_MS while order is active.
// Only runs when the current user IS the provider and order is confirmed/in_progress.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import * as Location from 'expo-location'
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { firestore } from '../lib/firebase'
import type { Order } from '@workfix/types'

const INTERVAL_MS  = 8_000   // publish every 8 seconds
const ACTIVE_STATUSES: Order['status'][] = ['confirmed', 'in_progress']

export function useProviderTracking(
  orderId:    string | null | undefined,
  order:      Pick<Order, 'status' | 'providerId'> | null,
  currentUid: string | null | undefined,
) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const isActive =
      orderId &&
      order &&
      currentUid &&
      order.providerId === currentUid &&
      ACTIVE_STATUSES.includes(order.status)

    if (!isActive) {
      _stop(timerRef)
      return
    }

    // Publish once immediately, then on interval
    void _publish(orderId!, currentUid!)
    timerRef.current = setInterval(() => {
      void _publish(orderId!, currentUid!)
    }, INTERVAL_MS)

    return () => {
      _stop(timerRef)
      // Remove stale location doc when provider leaves the screen
      void deleteDoc(doc(firestore, 'providerLocations', orderId!)).catch(() => {})
    }
  }, [orderId, order?.status, order?.providerId, currentUid])
}

async function _publish(orderId: string, providerId: string) {
  try {
    const { status } = await Location.getForegroundPermissionsAsync()
    if (status !== 'granted') return

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })

    await setDoc(doc(firestore, 'providerLocations', orderId), {
      lat:        pos.coords.latitude,
      lng:        pos.coords.longitude,
      heading:    pos.coords.heading ?? null,
      accuracy:   pos.coords.accuracy ?? null,
      providerId,
      updatedAt:  serverTimestamp(),
    })
  } catch {
    // Silent — tracking is best-effort; not critical to order flow
  }
}

function _stop(ref: React.MutableRefObject<ReturnType<typeof setInterval> | null>) {
  if (ref.current !== null) {
    clearInterval(ref.current)
    ref.current = null
  }
}
