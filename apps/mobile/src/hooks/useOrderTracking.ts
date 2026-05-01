// ─────────────────────────────────────────────────────────────────────────────
// useOrderTracking — customer side
// Real-time subscription to the provider's published location for a given order.
// Returns null when no location is available (provider hasn't published yet).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestore } from '../lib/firebase'

export interface ProviderLocation {
  lat:       number
  lng:       number
  heading:   number | null
  accuracy:  number | null
  updatedAt: Date | null
}

export function useOrderTracking(orderId: string | null | undefined): ProviderLocation | null {
  const [location, setLocation] = useState<ProviderLocation | null>(null)

  useEffect(() => {
    if (!orderId) {
      setLocation(null)
      return
    }

    const ref = doc(firestore, 'providerLocations', orderId)
    const unsub = onSnapshot(ref, snap => {
      if (!snap.exists()) {
        setLocation(null)
        return
      }
      const d = snap.data()
      setLocation({
        lat:       d['lat'],
        lng:       d['lng'],
        heading:   d['heading'] ?? null,
        accuracy:  d['accuracy'] ?? null,
        updatedAt: d['updatedAt']?.toDate?.() ?? null,
      })
    }, () => setLocation(null))

    return unsub
  }, [orderId])

  return location
}
