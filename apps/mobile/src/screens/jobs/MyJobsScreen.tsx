// ─────────────────────────────────────────────────────────────────────────────
// My Jobs Screen — provider manages their posted job openings
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useJobsStore } from '../../stores/jobsStore'
import { useAuthStore } from '../../stores/authStore'
import { EmptyState } from '../../components/marketplace'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'
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
      {/* Create job button */}
      <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/jobs/create')} activeOpacity={0.85}>
        <Text style={styles.createBtnText}>+ {t('jobs.createJob')}</Text>
      </TouchableOpacity>

      <FlatList
        data={myJobs}
        keyExtractor={j => j.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          myJobsLoading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
            : <EmptyState emoji="💼" title={t('jobs.noJobs')} subtitle={t('jobs.noJobsDesc')} />
        }
        renderItem={({ item }) => {
          const sc = STATUS_CONFIG[item.status]
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.color }]}>{t(`jobs.status_${item.status}`)}</Text>
                </View>
              </View>

              <Text style={styles.location}>📍 {item.location}</Text>
              <Text style={styles.applicationsCount}>
                👥 {item.applicationsCount} {t('jobs.applications')}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => router.push(`/jobs/${item.id}/applications`)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>{t('jobs.viewApplications')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, item.status === 'open' ? styles.actionBtnDanger : styles.actionBtnSuccess]}
                  onPress={() => confirmToggleStatus(item)}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.actionBtnText, { color: item.status === 'open' ? Colors.error : Colors.success }]}>
                    {item.status === 'open' ? t('jobs.closeJob') : t('jobs.reopenJob')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  createBtn:    { margin: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  createBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  list:         { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.md },
  card:         { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  cardTitle:    { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray900 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  statusText:   { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  location:     { fontSize: FontSize.sm, color: Colors.gray500 },
  applicationsCount: { fontSize: FontSize.sm, color: Colors.gray600 },
  actions:      { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  actionBtn:    { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  actionBtnDanger:  { borderColor: Colors.errorLight, backgroundColor: Colors.errorLight },
  actionBtnSuccess: { borderColor: Colors.successLight, backgroundColor: Colors.successLight },
  actionBtnText:    { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.primary },
})
