// ─────────────────────────────────────────────────────────────────────────────
// Provider Profile Screen — full view with services, reviews, book CTA
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMarketplaceStore } from '../../stores/marketplaceStore'
import { Analytics } from '../../lib/analytics'
import { StarRating } from '../../components/marketplace'
import { Button } from '../../components/ui'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow, IconSize, AvatarSize } from '../../constants/theme'
import { formatDate } from '@workfix/utils'
import type { Review } from '@workfix/types'

export default function ProviderProfileScreen() {
  const { t }  = useTranslation()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { selectedProvider, profileLoading, getProviderProfile } = useMarketplaceStore()

  useEffect(() => {
    if (id) {
      void getProviderProfile(id)
      Analytics.providerProfileView(id, 'search')
    }
  }, [id])

  if (profileLoading || !selectedProvider) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    )
  }

  const p       = selectedProvider
  const reviews = (p.reviews ?? []) as Review[]

  return (
    <View style={styles.container}>
      <ScreenHeader title={p.displayName ?? t('provider.provider')} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Hero banner ────────────────────────────────────────────────── */}
        <View style={styles.hero}>

          <View style={styles.avatar_section}>
            {p.avatarUrl ? (
              <Image source={{ uri: p.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatar_placeholder]}>
                <Text style={styles.avatar_letter}>
                  {(p.displayName ?? '?')[0]?.toUpperCase()}
                </Text>
              </View>
            )}
            {p.kycStatus === 'approved' && (
              <View style={styles.verified_badge}>
                <Text style={styles.verified_text}>✓ {t('provider.verified')}</Text>
              </View>
            )}
          </View>

          <Text style={styles.name}>{p.displayName ?? '—'}</Text>
          <Text style={styles.type_badge}>
            {p.type === 'individual' ? t('auth.individual') : t('auth.company')}
            {p.businessName ? ` · ${p.businessName}` : ''}
          </Text>

          {/* Stats row */}
          <View style={styles.stats_row}>
            <View style={styles.stat}>
              <Text style={styles.stat_value}>{p.avgRating.toFixed(1)}</Text>
              <Text style={styles.stat_label}>{t('provider.rating')}</Text>
            </View>
            <View style={styles.stat_divider} />
            <View style={styles.stat}>
              <Text style={styles.stat_value}>{p.totalReviews}</Text>
              <Text style={styles.stat_label}>{t('provider.reviews')}</Text>
            </View>
            <View style={styles.stat_divider} />
            <View style={styles.stat}>
              <Text style={styles.stat_value}>{p.totalCompletedOrders}</Text>
              <Text style={styles.stat_label}>{t('provider.completedOrders')}</Text>
            </View>
          </View>
        </View>

        {/* ── About ──────────────────────────────────────────────────────── */}
        {p.bio && (
          <View style={styles.section}>
            <Text style={styles.section_title}>{t('provider.about')}</Text>
            <Text style={styles.bio_text}>{p.bio}</Text>
          </View>
        )}

        {/* ── Working hours ───────────────────────────────────────────────── */}
        {p.workingHours && (
          <View style={styles.section}>
            <Text style={styles.section_title}>{t('provider.workingHours')}</Text>
            {Object.entries(p.workingHours).map(([day, hours]) => (
              <View key={day} style={styles.hours_row}>
                <Text style={styles.hours_day}>{t(`days.${day}`)}</Text>
                <Text style={styles.hours_time}>
                  {hours.isOff
                    ? t('provider.dayOff')
                    : `${hours.open} – ${hours.close}`
                  }
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Reviews ────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.section_header}>
            <Text style={styles.section_title}>{t('provider.reviews')}</Text>
            <StarRating rating={p.avgRating} total={p.totalReviews} />
          </View>

          {reviews.length === 0 ? (
            <Text style={styles.no_reviews}>{t('provider.noReviews')}</Text>
          ) : (
            reviews.map(r => <ReviewCard key={r.id} review={r} />)
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Sticky CTA ─────────────────────────────────────────────────── */}
      <View style={styles.cta_bar}>
        <Button
          label={t('provider.bookNow')}
          onPress={() => router.push({
            pathname: '/orders/create',
            params: { providerId: id },
          })}
          style={styles.cta_btn}
        />
        <TouchableOpacity
          style={styles.chat_btn}
          onPress={() => router.push({
              pathname: '/chat/[id]',
              params: { id: `direct_${id}` },
            })}
        >
          <Text style={styles.chat_icon}>💬</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function ReviewCard({ review }: { review: Review }) {
  const { t } = useTranslation()
  return (
    <View style={reviewStyles.card}>
      <View style={reviewStyles.header}>
        <View style={reviewStyles.avatar}>
          <Text style={reviewStyles.avatar_letter}>
            {(review.reviewerName ?? '?')[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={reviewStyles.meta}>
          <Text style={reviewStyles.name}>{review.reviewerName}</Text>
          <Text style={reviewStyles.date}>
            {formatDate(review.createdAt, 'ar', 'relative')}
          </Text>
        </View>
        <StarRating rating={review.rating} showCount={false} size="sm" />
      </View>
      {review.comment && <Text style={reviewStyles.comment}>{review.comment}</Text>}
    </View>
  )
}

const reviewStyles = StyleSheet.create({
  card:    { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  header:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
  avatar:  { width: AvatarSize.sm, height: AvatarSize.sm, borderRadius: Radius.full, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatar_letter: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  meta:    { flex: 1 },
  name:    { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.black },
  date:    { fontSize: FontSize.xs, color: Colors.gray400 },
  comment: { fontSize: FontSize.md, color: Colors.gray700, lineHeight: 22 },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: {
    backgroundColor: Colors.white,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    ...Shadow.md,
  },

  avatar_section: { position: 'relative', marginBottom: Spacing.md },
  avatar: { width: AvatarSize.xxl, height: AvatarSize.xxl, borderRadius: Radius.full, borderWidth: 3, borderColor: Colors.white, ...Shadow.md },
  avatar_placeholder: { backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatar_letter: { fontSize: IconSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },

  verified_badge: {
    position: 'absolute', bottom: -8, alignSelf: 'center',
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 3,
  },
  verified_text: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  name:       { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black, marginTop: Spacing.sm },
  type_badge: { fontSize: FontSize.sm, color: Colors.gray500, marginTop: 4 },

  stats_row:   { flexDirection: 'row', marginTop: Spacing.lg, paddingHorizontal: Spacing.xl },
  stat:        { flex: 1, alignItems: 'center' },
  stat_value:  { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  stat_label:  { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 },
  stat_divider:{ width: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },

  section: { backgroundColor: Colors.white, margin: Spacing.md, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  section_title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },
  section_header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  bio_text:   { fontSize: FontSize.md, color: Colors.gray700, lineHeight: 24 },
  no_reviews: { fontSize: FontSize.md, color: Colors.gray400, textAlign: 'center', paddingVertical: Spacing.md },

  hours_row:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  hours_day:  { fontSize: FontSize.md, color: Colors.gray700, fontWeight: FontWeight.medium },
  hours_time: { fontSize: FontSize.md, color: Colors.gray500 },

  cta_bar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: Spacing.md,
    padding: Spacing.lg, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
    ...Shadow.lg,
  },
  cta_btn:  { flex: 1 },
  chat_btn: {
    width: 52, height: 52, borderRadius: Radius.md,
    backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  chat_icon: { fontSize: IconSize.md },
})
