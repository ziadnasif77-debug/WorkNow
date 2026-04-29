// ─────────────────────────────────────────────────────────────────────────────
// Provider Statistics Screen — earnings, orders, ratings overview
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { firestore, firebaseAuth } from '../../lib/firebase'
import { formatPrice } from '@workfix/utils'
import { Card, LoadingState } from '../../components/ui'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize } from '../../constants/theme'

interface Stats {
  totalOrders:     number
  completedOrders: number
  cancelledOrders: number
  totalEarnings:   number
  avgRating:       number
  totalReviews:    number
  thisMonthOrders: number
  thisMonthEarnings: number
}

export default function ProviderStatsScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as import('@workfix/types').SupportedLocale
  const uid   = firebaseAuth.currentUser?.uid

  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    void loadStats()
  }, [uid])

  async function loadStats() {
    if (!uid) return
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(firestore, 'orders'), where('providerId', '==', uid)),
      )
      const orders = snap.docs.map(d => d.data())
      const now     = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const completed    = orders.filter(o => o['status'] === 'closed')
      const cancelled    = orders.filter(o => o['status'] === 'cancelled')
      const thisMonth    = completed.filter(o =>
        (o['closedAt']?.toDate?.() ?? new Date(0)) >= monthStart,
      )
      const totalEarn    = completed.reduce((s, o) => s + (o['netAmount'] ?? 0), 0)
      const monthEarn    = thisMonth.reduce((s, o) => s + (o['netAmount'] ?? 0), 0)

      // Use doc() directly — Firestore doesn't index the internal 'id' field
      const profileSnap = await getDoc(doc(firestore, 'providerProfiles', uid))
      const profile = profileSnap.exists() ? profileSnap.data() : undefined

      setStats({
        totalOrders:      orders.length,
        completedOrders:  completed.length,
        cancelledOrders:  cancelled.length,
        totalEarnings:    totalEarn,
        avgRating:        profile?.['avgRating'] ?? 0,
        totalReviews:     profile?.['totalReviews'] ?? 0,
        thisMonthOrders:  thisMonth.length,
        thisMonthEarnings: monthEarn,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('profile.statistics')} />

      {loading ? (
        <LoadingState />
      ) : !stats ? null : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* This Month */}
          <Text style={styles.section_label}>{t('stats.thisMonth')}</Text>
          <View style={styles.cards_row}>
            <StatCard emoji="📋" label={t('stats.orders')}   value={String(stats.thisMonthOrders)} />
            <StatCard emoji="💰" label={t('stats.earnings')} value={formatPrice(stats.thisMonthEarnings, 'SAR', lang)} />
          </View>

          {/* All time */}
          <Text style={styles.section_label}>{t('stats.allTime')}</Text>
          <View style={styles.cards_row}>
            <StatCard emoji="✅" label={t('stats.completed')} value={String(stats.completedOrders)} color={Colors.success} />
            <StatCard emoji="❌" label={t('stats.cancelled')} value={String(stats.cancelledOrders)} color={Colors.error} />
          </View>
          <View style={styles.cards_row}>
            <StatCard emoji="⭐" label={t('stats.rating')}   value={stats.avgRating.toFixed(1)} color={Colors.amber} />
            <StatCard emoji="💬" label={t('stats.reviews')}  value={String(stats.totalReviews)} />
          </View>

          {/* Total earnings */}
          <View style={styles.earnings_card}>
            <Text style={styles.earnings_label}>{t('stats.totalEarnings')}</Text>
            <Text style={styles.earnings_value}>{formatPrice(stats.totalEarnings, 'SAR', lang)}</Text>
            <Text style={styles.earnings_note}>{t('stats.afterCommission')}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function StatCard({ emoji, label, value, color }: {
  emoji: string; label: string; value: string; color?: string
}) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', gap: Spacing.xs }} padding={Spacing.md}>
      <Text style={cardStyles.emoji}>{emoji}</Text>
      <Text style={[cardStyles.value, color ? { color } : {}]}>{value}</Text>
      <Text style={cardStyles.label}>{label}</Text>
    </Card>
  )
}

const cardStyles = StyleSheet.create({
  emoji: { fontSize: IconSize.lg },
  value: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  label: { fontSize: FontSize.xs, color: Colors.gray500 },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md },
  section_label: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray600, paddingTop: Spacing.sm },
  cards_row: { flexDirection: 'row', gap: Spacing.md },
  earnings_card: {
    backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.xl,
    alignItems: 'center', gap: Spacing.sm,
  },
  earnings_label: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.8)' },
  earnings_value: { fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white },
  earnings_note:  { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },
})
