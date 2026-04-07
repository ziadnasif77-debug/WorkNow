// ─────────────────────────────────────────────────────────────────────────────
// Provider Statistics Screen — earnings, orders, ratings overview
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { firestore, firebaseAuth } from '../../lib/firebase'
import { formatPrice } from '@workfix/utils'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow, IconSize } from '../../constants/theme'

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
  const { t }   = useTranslation()
  const router  = useRouter()
  const uid     = firebaseAuth.currentUser?.uid

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

      const profileSnap  = await getDocs(
        query(collection(firestore, 'providerProfiles'), where('id', '==', uid)),
      )
      const profile = profileSnap.docs[0]?.data()

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
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : !stats ? null : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* This Month */}
          <Text style={styles.section_label}>هذا الشهر</Text>
          <View style={styles.cards_row}>
            <StatCard emoji="📋" label="الطلبات" value={String(stats.thisMonthOrders)} />
            <StatCard emoji="💰" label="الأرباح" value={formatPrice(stats.thisMonthEarnings, 'SAR', 'ar')} />
          </View>

          {/* All time */}
          <Text style={styles.section_label}>إجمالي</Text>
          <View style={styles.cards_row}>
            <StatCard emoji="✅" label="مكتملة"   value={String(stats.completedOrders)} color={Colors.success} />
            <StatCard emoji="❌" label="ملغاة"    value={String(stats.cancelledOrders)} color={Colors.error} />
          </View>
          <View style={styles.cards_row}>
            <StatCard emoji="⭐" label="التقييم"  value={stats.avgRating.toFixed(1)} color="#F59E0B" />
            <StatCard emoji="💬" label="تقييمات"  value={String(stats.totalReviews)} />
          </View>

          {/* Total earnings */}
          <View style={styles.earnings_card}>
            <Text style={styles.earnings_label}>إجمالي الأرباح</Text>
            <Text style={styles.earnings_value}>{formatPrice(stats.totalEarnings, 'SAR', 'ar')}</Text>
            <Text style={styles.earnings_note}>بعد خصم عمولة المنصة (12%)</Text>
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
    <View style={cardStyles.card}>
      <Text style={cardStyles.emoji}>{emoji}</Text>
      <Text style={[cardStyles.value, color ? { color } : {}]}>{value}</Text>
      <Text style={cardStyles.label}>{label}</Text>
    </View>
  )
}

const cardStyles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
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
