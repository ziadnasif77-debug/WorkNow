// ─────────────────────────────────────────────────────────────────────────────
// Admin Reports Screen — financial reports with period selector
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'

type Period = 'this_month' | 'last_month' | 'last_3_months' | 'this_year'

interface FinancialReport {
  totalRevenue:     number
  totalPayouts:     number
  netRevenue:       number
  currency:         string
  ordersCount?:     number
  completedOrders?: number
  cancelledOrders?: number
  avgOrderValue?:   number
  topProviders?:    { providerId: string; name?: string; revenue: number }[]
  commissionTotal?: number
}

const PERIOD_LABELS: Record<Period, string> = {
  this_month:    'هذا الشهر',
  last_month:    'الشهر الماضي',
  last_3_months: 'آخر 3 أشهر',
  this_year:     'هذه السنة',
}

function getPeriodRange(period: Period): { from: Date; to: Date } {
  const now  = new Date()
  const year = now.getFullYear()
  const mon  = now.getMonth()

  switch (period) {
    case 'this_month':
      return { from: new Date(year, mon, 1), to: now }
    case 'last_month':
      return { from: new Date(year, mon - 1, 1), to: new Date(year, mon, 0, 23, 59, 59) }
    case 'last_3_months':
      return { from: new Date(year, mon - 3, 1), to: now }
    case 'this_year':
      return { from: new Date(year, 0, 1), to: now }
  }
}

export default function AdminReportsScreen() {
  const [period,     setPeriod]     = useState<Period>('this_month')
  const [report,     setReport]     = useState<FinancialReport | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const load = useCallback(async (p: Period = period) => {
    setLoading(true)
    setError(null)
    try {
      const { from, to } = getPeriodRange(p)
      const fn = httpsCallable<{ from: string; to: string }, FinancialReport>(
        getFunctions(undefined, 'me-central1'), 'admin-getFinancialReport'
      )
      const res = await fn({ from: from.toISOString(), to: to.toISOString() })
      setReport(res.data)
    } catch (e) {
      setError('تعذّر تحميل التقرير')
      if (__DEV__) console.warn('[Reports] load error', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [period])

  const selectPeriod = useCallback((p: Period) => {
    setPeriod(p)
    void load(p)
  }, [load])

  const onRefresh = useCallback(() => { setRefreshing(true); void load() }, [load])

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.error} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>التقارير المالية 📈</Text>
        </View>

        {/* Period selector */}
        <View style={styles.periodRow}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => selectPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {PERIOD_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.error} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : report == null ? (
          <View style={styles.center}>
            <Text style={styles.hintText}>اختر فترة زمنية لعرض التقرير</Text>
          </View>
        ) : (
          <>
            {/* Revenue summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ملخص الإيرادات</Text>
              <View style={styles.card}>
                <ReportRow label="إجمالي الإيرادات"   value={report.totalRevenue}   currency={report.currency} />
                <ReportRow label="إجمالي المدفوعات"   value={report.totalPayouts}   currency={report.currency} />
                {report.commissionTotal != null && (
                  <ReportRow label="إجمالي العمولات"  value={report.commissionTotal} currency={report.currency} />
                )}
                <View style={styles.divider} />
                <ReportRow label="صافي الإيراد"       value={report.netRevenue}     currency={report.currency} bold />
              </View>
            </View>

            {/* Orders summary */}
            {(report.ordersCount != null || report.completedOrders != null) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>ملخص الطلبات</Text>
                <View style={styles.statsRow}>
                  {report.ordersCount != null && (
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>{report.ordersCount}</Text>
                      <Text style={styles.statLbl}>إجمالي</Text>
                    </View>
                  )}
                  {report.completedOrders != null && (
                    <View style={[styles.statBox, styles.statBoxSuccess]}>
                      <Text style={[styles.statVal, styles.statValSuccess]}>{report.completedOrders}</Text>
                      <Text style={styles.statLbl}>مكتمل</Text>
                    </View>
                  )}
                  {report.cancelledOrders != null && (
                    <View style={[styles.statBox, styles.statBoxError]}>
                      <Text style={[styles.statVal, styles.statValError]}>{report.cancelledOrders}</Text>
                      <Text style={styles.statLbl}>ملغي</Text>
                    </View>
                  )}
                  {report.avgOrderValue != null && (
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>
                        {report.avgOrderValue.toLocaleString('ar-SA', { maximumFractionDigits: 0 })}
                      </Text>
                      <Text style={styles.statLbl}>متوسط (SAR)</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Top providers */}
            {(report.topProviders ?? []).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>أفضل مزوّدو الخدمات</Text>
                <View style={styles.card}>
                  {(report.topProviders ?? []).map((p, i) => (
                    <View key={p.providerId} style={[styles.providerRow, i > 0 && styles.providerRowBorder]}>
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.providerName} numberOfLines={1}>
                        {p.name ?? p.providerId.slice(-8)}
                      </Text>
                      <Text style={styles.providerRevenue}>
                        {p.revenue.toLocaleString('ar-SA')} {report.currency}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

function ReportRow({ label, value, currency, bold }: { label: string; value: number; currency: string; bold?: boolean }) {
  return (
    <View style={styles.reportRow}>
      <Text style={[styles.reportLabel, bold && styles.reportBold]}>{label}</Text>
      <Text style={[styles.reportValue, bold && styles.reportBold]}>
        {value.toLocaleString('ar-SA')} {currency}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll:           { padding: Spacing.md, paddingBottom: Spacing.xxl },
  center:           { paddingVertical: Spacing.xxl, alignItems: 'center' },
  header:           { marginBottom: Spacing.md },
  title:            { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },
  periodRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.lg },
  periodBtn:        { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  periodBtnActive:  { backgroundColor: Colors.error, borderColor: Colors.error },
  periodText:       { fontSize: FontSize.sm, color: Colors.gray600 },
  periodTextActive: { color: Colors.white, fontWeight: FontWeight.bold },
  section:          { marginBottom: Spacing.lg },
  sectionTitle:     { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: Spacing.sm },
  card:             { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  reportRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  reportLabel:      { fontSize: FontSize.md, color: Colors.gray700 },
  reportValue:      { fontSize: FontSize.md, color: Colors.gray700 },
  reportBold:       { fontWeight: FontWeight.bold, color: Colors.black },
  divider:          { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  statsRow:         { flexDirection: 'row', gap: Spacing.sm },
  statBox:          { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', ...Shadow.sm },
  statBoxSuccess:   { backgroundColor: Colors.successLight },
  statBoxError:     { backgroundColor: Colors.errorLight },
  statVal:          { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },
  statValSuccess:   { color: Colors.success },
  statValError:     { color: Colors.error },
  statLbl:          { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2, textAlign: 'center' },
  providerRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  providerRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  rankBadge:        { width: 28, height: 28, borderRadius: Radius.full, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  rankText:         { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  providerName:     { flex: 1, fontSize: FontSize.md, color: Colors.black },
  providerRevenue:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.success },
  errorText:        { fontSize: FontSize.md, color: Colors.error, marginBottom: Spacing.md },
  retryBtn:         { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.error, borderRadius: Radius.md },
  retryText:        { color: Colors.white, fontWeight: FontWeight.bold },
  hintText:         { fontSize: FontSize.md, color: Colors.gray500 },
})
