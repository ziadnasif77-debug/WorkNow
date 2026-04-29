// ─────────────────────────────────────────────────────────────────────────────
// MapLocationPicker — interactive map for selecting a service location
// Requires Google Maps API key set in app.json android.config.googleMaps.apiKey
// Falls back gracefully if react-native-maps is not available (Expo Go).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../constants/theme'

interface Region {
  latitude:      number
  longitude:     number
  latitudeDelta:  number
  longitudeDelta: number
}

interface MapLocationPickerProps {
  initialLat:  number
  initialLng:  number
  onConfirm:   (lat: number, lng: number) => void
  style?:      object
}

// Lazy-require react-native-maps so the app doesn't crash in Expo Go
let MapView: React.ComponentType<{
  style?: object
  initialRegion?: Region
  onRegionChangeComplete?: (r: Region) => void
  provider?: string | null
}> | null = null

let Marker: React.ComponentType<{
  coordinate: { latitude: number; longitude: number }
}> | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('react-native-maps') as {
    default: typeof MapView
    Marker:  typeof Marker
  }
  MapView = mod.default
  Marker  = mod.Marker
} catch {
  // Expo Go / web — map will not render
}

export function MapLocationPicker({ initialLat, initialLng, onConfirm, style }: MapLocationPickerProps) {
  const { t } = useTranslation()
  const [region, setRegion] = useState<Region>({
    latitude:      initialLat,
    longitude:     initialLng,
    latitudeDelta:  0.005,
    longitudeDelta: 0.005,
  })

  if (!MapView || !Marker) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallback_icon}>📍</Text>
        <Text style={styles.fallback_title}>{t('orders.mapUnavailable')}</Text>
        <Text style={styles.fallback_sub}>{t('orders.mapUnavailableSub')}</Text>
        <TouchableOpacity
          style={styles.confirm_btn}
          onPress={() => onConfirm(initialLat, initialLng)}
        >
          <Text style={styles.confirm_text}>{t('orders.useCurrentLocation')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      <MapView
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        provider="google"
      >
        <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} />
      </MapView>

      {/* Crosshair hint */}
      <View style={styles.crosshair} pointerEvents="none">
        <Text style={styles.crosshair_icon}>＋</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.coords}>
          {region.latitude.toFixed(5)}, {region.longitude.toFixed(5)}
        </Text>
        <TouchableOpacity
          style={styles.confirm_btn}
          onPress={() => onConfirm(region.latitude, region.longitude)}
        >
          <Text style={styles.confirm_text}>{t('orders.confirmLocation')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.md },
  map:       { width: '100%', height: 260 },

  crosshair: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  crosshair_icon: { fontSize: 28, color: Colors.primary, fontWeight: '300' },

  footer: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  coords: { flex: 1, fontSize: FontSize.xs, color: Colors.gray500, fontFamily: 'monospace' },

  confirm_btn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  confirm_text: { color: Colors.white, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  fallback: {
    backgroundColor: Colors.gray100, borderRadius: Radius.lg,
    padding: Spacing.xl, alignItems: 'center', gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  fallback_icon:  { fontSize: 40 },
  fallback_title: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  fallback_sub:   { fontSize: FontSize.sm, color: Colors.gray500, textAlign: 'center' },
})
