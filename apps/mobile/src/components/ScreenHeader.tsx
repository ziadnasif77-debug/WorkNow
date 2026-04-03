// ─────────────────────────────────────────────────────────────────────────────
// ScreenHeader — shared header used by detail/form screens
// Eliminates the identical header StyleSheet duplicated in 18+ screens
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Colors, Spacing, FontSize, FontWeight } from '../constants/theme'

interface ScreenHeaderProps {
  title:       string
  onBack?:     () => void   // defaults to router.back()
  rightEl?:    React.ReactNode
}

export function ScreenHeader({ title, onBack, rightEl }: ScreenHeaderProps) {
  const router = useRouter()

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack ?? (() => router.back())} style={styles.back} accessibilityLabel="رجوع" accessibilityRole="button">
        <Text style={styles.back_icon}>←</Text>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.right}>{rightEl ?? null}</View>
    </View>
  )
}

export const headerStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  back:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  back_icon: { fontSize: 22, color: Colors.black },
  title:     { flex: 1, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  right:     { minWidth: 36 },
})

const styles = headerStyles
