// ─────────────────────────────────────────────────────────────────────────────
// OfflineBanner — persistent bar shown when device is offline
// Uses the simpler useIsOnline() variant — no extra state needed here
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useIsOnline } from '../hooks/useNetworkState'
import { Colors, FontSize, FontWeight, Spacing } from '../constants/theme'

export function OfflineBanner() {
  const isOnline = useIsOnline()
  if (isOnline) return null

  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.text}>📡 لا يوجد اتصال بالإنترنت</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor:   Colors.warning,
    paddingVertical:   Spacing.xs,
    paddingHorizontal: Spacing.md,
    alignItems:        'center',
  },
  text: {
    color:      Colors.white,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
  },
})
