// ─────────────────────────────────────────────────────────────────────────────
// My Applications Screen — customer sees their submitted job applications
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useJobsStore } from '../../stores/jobsStore'
import { useAuthStore } from '../../stores/authStore'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Badge, Card, EmptyState, SkeletonList } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'
import type { JobApplication } from '@workfix/types'

// Text color per application status (bg = color + '20' transparency)
const STATUS_COLORS: Record<JobApplication['status'], string> = {
  pending:     Colors.warning,
  viewed:      Colors.primary,
  shortlisted: Colors.success,
  rejected:    Colors.error,
}

export default function MyApplicationsScreen() {
  const { t }   = useTranslation()
  const uid     = useAuthStore(s => s.appUser?.id)
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
            ? <SkeletonList count={4} hasAvatar />
            : <EmptyState emoji="📬" title={t('jobs.noApplications')} subtitle="" />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.card_top}>
              <Text style={styles.job_title} numberOfLines={2}>{item.jobTitle}</Text>
              <Badge
                variant="custom"
                bg={STATUS_COLORS[item.status] + '20'}
                color={STATUS_COLORS[item.status]}
                label={t(`jobs.app_${item.status}`)}
              />
            </View>
            {item.cvFileName && (
              <Text style={styles.cv_meta}>📎 {item.cvFileName}</Text>
            )}
            <Text style={styles.date}>
              {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}
            </Text>
          </Card>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list:      { padding: Spacing.md, gap: Spacing.md },
  card_top:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  job_title: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray900 },
  cv_meta:   { fontSize: FontSize.sm, color: Colors.gray500 },
  date:      { fontSize: FontSize.xs, color: Colors.gray400 },
})
