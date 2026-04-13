// ─────────────────────────────────────────────────────────────────────────────
// My Jobs Screen — provider manages their posted job openings
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useJobsStore } from '../../stores/jobsStore'
import { useAuthStore } from '../../stores/authStore'
import { Badge, Button, Card, EmptyState, LoadingState } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'
import type { Job } from '@workfix/types'

const STATUS_CONFIG: Record<Job['status'], { color: string; bg: string }> = {
  open:   { color: Colors.success, bg: Colors.successLight },
  closed: { color: Colors.error,   bg: Colors.errorLight   },
  paused: { color: Colors.warning, bg: Colors.warningLight },
}

export default function MyJobsScreen() {
  const { t }       = useTranslation()
  const router      = useRouter()
  const uid         = useAuthStore(s => s.appUser?.id)
  const { myJobs, myJobsLoading, subscribeMyJobs, updateJobStatus, actionLoading, unsubscribeAll } = useJobsStore()

  useEffect(() => {
    if (uid) subscribeMyJobs(uid)
    return () => unsubscribeAll()
  }, [uid])

  function confirmToggleStatus(job: Job) {
    const isOpen    = job.status === 'open'
    const newStatus = isOpen ? 'closed' : 'open'
    Alert.alert(
      isOpen ? t('jobs.closeJob') : t('jobs.reopenJob'),
      '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: isOpen ? 'destructive' : 'default',
          onPress: () => void updateJobStatus({ jobId: job.id, status: newStatus }),
        },
      ],
    )
  }

  return (
    <View style={styles.container}>
      <Button
        label={`+ ${t('jobs.createJob')}`}
        onPress={() => router.push('/jobs/create')}
        style={styles.create_btn}
      />

      <FlatList
        data={myJobs}
        keyExtractor={j => j.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          myJobsLoading
            ? <LoadingState />
            : <EmptyState emoji="💼" title={t('jobs.noJobs')} subtitle={t('jobs.noJobsDesc')} />
        }
        renderItem={({ item }) => {
          const sc = STATUS_CONFIG[item.status]
          return (
            <Card>
              <View style={styles.card_top}>
                <Text style={styles.card_title} numberOfLines={1}>{item.title}</Text>
                <Badge variant="custom" bg={sc.bg} color={sc.color} label={t(`jobs.status_${item.status}`)} />
              </View>
              <Text style={styles.location}>📍 {item.location}</Text>
              <Text style={styles.applications_count}>
                👥 {item.applicationsCount} {t('jobs.applications')}
              </Text>
              <View style={styles.actions}>
                <Button
                  label={t('jobs.viewApplications')}
                  onPress={() => router.push(`/jobs/${item.id}/applications`)}
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  style={styles.action_btn}
                />
                <Button
                  label={item.status === 'open' ? t('jobs.closeJob') : t('jobs.reopenJob')}
                  onPress={() => confirmToggleStatus(item)}
                  variant={item.status === 'open' ? 'destructive' : 'success'}
                  size="sm"
                  fullWidth={false}
                  disabled={actionLoading}
                  style={styles.action_btn}
                />
              </View>
            </Card>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.background },
  create_btn:         { margin: Spacing.md },
  list:               { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.md },
  card_top:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  card_title:         { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray900 },
  location:           { fontSize: FontSize.sm, color: Colors.gray500 },
  applications_count: { fontSize: FontSize.sm, color: Colors.gray600 },
  actions:            { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  action_btn:         { flex: 1 },
})
