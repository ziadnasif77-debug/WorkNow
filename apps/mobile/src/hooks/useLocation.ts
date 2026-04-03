// ─────────────────────────────────────────────────────────────────────────────
// useLocation — requests location permission + returns current coords
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import * as Location from 'expo-location'

interface LocationState {
  lat:       number | null
  lng:       number | null
  city:      string
  country:   string
  isLoading: boolean
  error:     string | null
  refresh:   () => Promise<void>
}

// Default: Riyadh, Saudi Arabia
const DEFAULT = { lat: 24.7136, lng: 46.6753, city: 'الرياض', country: 'SA' }

export function useLocation(): LocationState {
  const [lat,       setLat]       = useState<number | null>(null)
  const [lng,       setLng]       = useState<number | null>(null)
  const [city,      setCity]      = useState(DEFAULT.city)
  const [country,   setCountry]   = useState(DEFAULT.country)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  async function fetch() {
    setIsLoading(true)
    setError(null)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        // Fall back to defaults silently — no hard error
        setLat(DEFAULT.lat)
        setLng(DEFAULT.lng)
        return
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      setLat(pos.coords.latitude)
      setLng(pos.coords.longitude)

      // Reverse geocode for city/country
      const [place] = await Location.reverseGeocodeAsync({
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
      if (place) {
        setCity(place.city ?? place.region ?? DEFAULT.city)
        setCountry(place.isoCountryCode ?? DEFAULT.country)
      }
    } catch {
      setError('تعذّر تحديد موقعك')
      setLat(DEFAULT.lat)
      setLng(DEFAULT.lng)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void fetch() }, [])

  return { lat, lng, city, country, isLoading, error, refresh: fetch }
}
