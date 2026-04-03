// ─────────────────────────────────────────────────────────────────────────────
// Shared visual components used across Marketplace screens
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  type ViewStyle,
} from 'react-native'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../constants/theme'
import { formatPrice } from '@workfix/utils'
import type { Currency } from '@workfix/types'

// ─────────────────────────────────────────────────────────────────────────────
// STAR RATING
// ─────────────────────────────────────────────────────────────────────────────

interface StarRatingProps {
  rating:     number    // 0–5
  total?:     number
  size?:      'sm' | 'md'
  showCount?: boolean
}

export function StarRating({ rating, total, size = 'md', showCount = true }: StarRatingProps) {
  const starSize = size === 'sm' ? 12 : 14
  const filled = Math.round(rating)

  return (
    <View style={styles.stars_row}>
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={{ fontSize: starSize, color: i <= filled ? '#F59E0B' : Colors.gray200 }}>
          ★
        </Text>
      ))}
      {showCount && (
        <Text style={[styles.stars_count, size === 'sm' && styles.stars_count_sm]}>
          {rating.toFixed(1)}{total != null ? ` (${total})` : ''}
        </Text>
      )}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER CARD — used in search results and nearby section
// ─────────────────────────────────────────────────────────────────────────────

interface ProviderCardProps {
  id:           string
  displayName?: string
  avatarUrl?:   string
  type:         string
  avgRating:    number
  totalReviews: number
  distanceKm?:  number
  basePrice?:   number
  currency?:    Currency
  categoryName?: string
  isVerified?:  boolean
  isOnline?:    boolean
  onPress:      () => void
  style?:       ViewStyle
  horizontal?:  boolean
}

export function ProviderCard({
  displayName, avatarUrl, type, avgRating, totalReviews,
  distanceKm, basePrice, currency = 'SAR', categoryName,
  isVerified, isOnline, onPress, style, horizontal,
}: ProviderCardProps) {
  if (horizontal) {
    return (
      <TouchableOpacity style={[styles.card_h, style]} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.avatar_wrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatar_placeholder]}>
              <Text style={styles.avatar_letter}>
                {(displayName ?? '?')[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          {isOnline && <View style={styles.online_dot} />}
        </View>

        <View style={styles.card_h_body}>
          <View style={styles.card_h_top}>
            <Text style={styles.card_name} numberOfLines={1}>
              {displayName ?? '—'}
            </Text>
            {isVerified && <Text style={styles.verified_badge}>✓</Text>}
          </View>
          {categoryName && (
            <Text style={styles.card_category} numberOfLines={1}>{categoryName}</Text>
          )}
          <StarRating rating={avgRating} total={totalReviews} size="sm" />
          <View style={styles.card_h_footer}>
            {distanceKm != null && (
              <Text style={styles.card_meta}>📍 {distanceKm.toFixed(1)} كم</Text>
            )}
            {basePrice != null && (
              <Text style={styles.card_price}>
                {formatPrice(basePrice, currency, 'ar')}+
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  // Vertical card (grid)
  return (
    <TouchableOpacity style={[styles.card_v, style]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.avatar_wrap}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar_lg} />
        ) : (
          <View style={[styles.avatar_lg, styles.avatar_placeholder]}>
            <Text style={styles.avatar_letter_lg}>
              {(displayName ?? '?')[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        {isOnline && <View style={[styles.online_dot, styles.online_dot_lg]} />}
        {isVerified && (
          <View style={styles.verified_badge_lg}>
            <Text style={styles.verified_text}>✓</Text>
          </View>
        )}
      </View>

      <Text style={styles.card_v_name} numberOfLines={1}>{displayName ?? '—'}</Text>
      {categoryName && <Text style={styles.card_v_cat} numberOfLines={1}>{categoryName}</Text>}
      <StarRating rating={avgRating} total={totalReviews} size="sm" showCount={false} />

      <View style={styles.card_v_footer}>
        {distanceKm != null && (
          <Text style={styles.card_meta_sm}>📍 {distanceKm.toFixed(1)} كم</Text>
        )}
        {basePrice != null && (
          <Text style={styles.card_price_sm}>{formatPrice(basePrice, currency, 'ar')}+</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY CHIP
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryChipProps {
  label:     string
  icon?:     string
  selected?: boolean
  onPress:   () => void
}

export function CategoryChip({ label, icon, selected, onPress }: CategoryChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chip_selected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon && <Text style={styles.chip_icon}>{icon}</Text>}
      <Text style={[styles.chip_label, selected && styles.chip_label_selected]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  emoji:    string
  title:    string
  subtitle?: string
  action?:  { label: string; onPress: () => void }
}

export function EmptyState({ emoji, title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <Text style={styles.empty_emoji}>{emoji}</Text>
      <Text style={styles.empty_title}>{title}</Text>
      {subtitle && <Text style={styles.empty_sub}>{subtitle}</Text>}
      {action && (
        <TouchableOpacity style={styles.empty_btn} onPress={action.onPress}>
          <Text style={styles.empty_btn_label}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_SIZE    = 52
const AVATAR_SIZE_LG = 72

const styles = StyleSheet.create({
  // Stars
  stars_row:      { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stars_count:    { fontSize: FontSize.sm, color: Colors.gray500, marginStart: 4 },
  stars_count_sm: { fontSize: FontSize.xs },

  // Horizontal card
  card_h: {
    flexDirection: 'row', gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.sm,
  },
  card_h_body:   { flex: 1, gap: 3 },
  card_h_top:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  card_h_footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  card_name:     { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black, flex: 1 },
  card_category: { fontSize: FontSize.sm, color: Colors.gray500 },
  card_meta:     { fontSize: FontSize.sm, color: Colors.gray500 },
  card_price:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  verified_badge: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },

  // Vertical card
  card_v: {
    width: 150, backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', gap: 4, ...Shadow.sm,
  },
  card_v_name: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.black, textAlign: 'center' },
  card_v_cat:  { fontSize: FontSize.xs, color: Colors.gray500, textAlign: 'center' },
  card_v_footer: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginTop: 2 },
  card_meta_sm: { fontSize: FontSize.xs, color: Colors.gray400 },
  card_price_sm: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },

  // Avatar
  avatar_wrap: { position: 'relative' },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatar_lg: { width: AVATAR_SIZE_LG, height: AVATAR_SIZE_LG, borderRadius: AVATAR_SIZE_LG / 2 },
  avatar_placeholder: { backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatar_letter:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  avatar_letter_lg: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.primary },
  online_dot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.success, borderWidth: 2, borderColor: Colors.white,
  },
  online_dot_lg: { width: 16, height: 16, borderRadius: 8 },
  verified_badge_lg: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  verified_text: { color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold },

  // Category chip
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.gray100,
    borderWidth: 1, borderColor: Colors.border,
  },
  chip_selected: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chip_icon:     { fontSize: 14 },
  chip_label:    { fontSize: FontSize.sm, color: Colors.gray700, fontWeight: FontWeight.medium },
  chip_label_selected: { color: Colors.primary, fontWeight: FontWeight.bold },

  // Empty state
  empty: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md },
  empty_emoji: { fontSize: 56 },
  empty_title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black, textAlign: 'center' },
  empty_sub:   { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center', lineHeight: 22 },
  empty_btn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, marginTop: Spacing.sm,
  },
  empty_btn_label: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
})
