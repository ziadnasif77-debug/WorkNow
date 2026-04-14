// ─────────────────────────────────────────────────────────────────────────────
// Admin Dashboard — overview stats + quick actions
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getFirestore, collection, query, where, getCountFromServer } from 'firebase/firestore'
import { useAuthStore } from '../../stores/authStore'
import { Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow, IconSize } from '../../constants/theme'

interface Stats {
  pendingKyc:      number
  openDisputes:    number
  totalUsers:      number
  totalOrders:     number
}

interface FinancialReport {
  totalRevenue:    number
  totalPayouts:    number
  netRevenue:      number
  currency:        string
}

export default function AdminDashboard() {
  const { firebaseUser } = useAuthStore()
  const [stats,    setStats]    = useState<Stats | null>(null)
  const [report,   setReport]   = useState<FinancialReport | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const db = getFirestore()
      const [kycSnap, disputeSnap, usersSnap, ordersSnap] = await Promise.all([
        getCountFromServer(query(collection(db, 'providerProfiles'), where('kycStatus', '==', 'pending'))),
        getCountFromServer(query(collection(db, 'disputes'), where('status', '==', 'open'))),
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(collection(db, 'orders')),
      ])

      setStats({
        pendingKyc:   kycSnap.data().count,
        openDisputes: disputeSnap.data().count,
        totalUsers:   usersSnap.data().count,
        totalOrders:  ordersSnap.data().count,
      })

      const fn = httpsCallable<{ period: string }, FinancialReport>(
        getFunctions(undefined, 'me-central1'), 'admin-getFinancialReport'
      )
      const res = await fn({ period: 'month' })
      setReport(res.data)
    } catch (e) {
      if (__DEV__) console.warn('[Admin] load error', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function onRefresh() { setRefreshing(true); void load() }

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.error} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.error} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>لوحة الإدارة 🛡️</Text>
          <Text style={styles.sub}>مرحباً {firebaseUser?.displayName ?? 'مشرف'}</Text>
        </View>

        {/* Stats grid */}
        {stats && (
          <View style={styles.grid}>
            <StatCard emoji="📋" label="KYC معلّق" value={stats.pendingKyc} urgent={stats.pendingKyc > 0} />
            <StatCard emoji="⚖️" label="نزاعات مفتوحة" value={stats.openDisputes} urgent={stats.openDisputes > 0} />
            <StatCard emoji="👥" label="إجمالي المستخدمين" value={stats.totalUsers} />
            <StatCard emoji="📦" label="إجمالي الطلبات" value={stats.totalOrders} />
          </View>
        )}

        {/* Financial report */}
        {report && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>التقرير المالي (هذا الشهر)</Text>
            <View style={styles.card}>
              <FinRow label="إجمالي الإيرادات" value={report.totalRevenue} currency={report.currency} />
              <FinRow label="إجمالي المدفوعات" value={report.totalPayouts} currency={report.currency} />
              <View style={styles.divider} />
              <FinRow label="صافي الإيراد" value={report.netRevenue} currency={report.currency} bold />
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

function StatCard({ emoji, label, value, urgent }: { emoji: string; label: string; value: number; urgent?: boolean }) {
  return (
    <View style={[styles.statCard, urgent && styles.statCardUrgent]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, urgent && styles.statValueUrgent]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function FinRow({ label, value, currency, bold }: { label: string; value: number; currency: string; bold?: boolean }) {
  return (
    <View style={styles.finRow}>
      <Text style={[styles.finLabel, bold && styles.finBold]}>{label}</Text>
      <Text style={[styles.finValue, bold && styles.finBold]}>
        {value.toLocaleString('ar-SA')} {currency}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll:          { padding: Spacing.md, paddingBottom: Spacing.xxl },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { marginBottom: Spacing.lg },
  title:           { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },
  sub:             { fontSize: FontSize.sm, color: Colors.gray500, marginTop: Spacing.xs },
  grid:            { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard:        { flex: 1, minWidth: '45%', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', ...Shadow.sm },
  statCardUrgent:  { backgroundColor: Colors.errorLight, borderWidth: 1, borderColor: Colors.error },
  statEmoji:       { fontSize: IconSize.xl, marginBottom: Spacing.xs },
  statValue:       { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.black },
  statValueUrgent: { color: Colors.error },
  statLabel:       { fontSize: FontSize.xs, color: Colors.gray500, marginTop: Spacing.xs, textAlign: 'center' },
  section:         { marginBottom: Spacing.lg },
  sectionTitle:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: Spacing.sm },
  card:            { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  finRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  finLabel:        { fontSize: FontSize.md, color: Colors.gray700 },
  finValue:        { fontSize: FontSize.md, color: Colors.gray700 },
  finBold:         { fontWeight: FontWeight.bold, color: Colors.black },
  divider:         { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
})
