// ─────────────────────────────────────────────────────────────────────────────
// My Applications Screen — customer sees their submitted job applications
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useJobsStore } from '../../stores/jobsStore'
import { useAuthStore } from '../../stores/authStore'
import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState } from '../../components/marketplace'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'
import type { JobApplication } from '@workfix/types'

const STATUS_COLORS: Record<JobApplication['status'], string> = {
  pending:     Colors.warning,
  viewed:      Colors.primary,
  shortlisted: Colors.success,
  rejected:    Colors.error,
}

export default function MyApplicationsScreen() {
  const { t }     = useTranslation()
  const uid       = useAuthStore(s => s.appUser?.id)
  const { myApplications, myApplicationsLoading, loadMyApplications } = useJobsStore()

  useEffect(() => {
    if (uid) void loadMyApplications(uid)
  }, [uid])

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('jobs.myApplications')} />

      <FlatList
        data={myApplications}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          myApplicationsLoading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
            : <EmptyState emoji="📬" title={t('jobs.noApplications')} subtitle="" />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.jobTitle} numberOfLines={2}>{item.jobTitle}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>
                  {t(`jobs.app_${item.status}`)}
                </Text>
              </View>
            </View>
            {item.cvFileName && (
              <Text style={styles.cvMeta}>📎 {item.cvFileName}</Text>
            )}
            <Text style={styles.date}>
              {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}
            </Text>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list:      { padding: Spacing.md, gap: Spacing.md },
  card:      { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  jobTitle:  { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray900 },
  badge:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  cvMeta:    { fontSize: FontSize.sm, color: Colors.gray500 },
  date:      { fontSize: FontSize.xs, color: Colors.gray400 },
})
