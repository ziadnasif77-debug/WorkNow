// ─────────────────────────────────────────────────────────────────────────────
// Jobs List Screen — browse all open job postings
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useJobsStore } from '../../stores/jobsStore'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'
import { EmptyState } from '../../components/marketplace'
import type { Job } from '@workfix/types'

function JobTypeTag({ type, t }: { type: Job['jobType']; t: (k: string) => string }) {
  const labels: Record<Job['jobType'], string> = {
    full_time:  t('jobs.fullTime'),
    part_time:  t('jobs.partTime'),
    freelance:  t('jobs.freelance'),
    internship: t('jobs.internship'),
  }
  const colors: Record<Job['jobType'], string> = {
    full_time:  Colors.primary,
    part_time:  Colors.success,
    freelance:  Colors.purple,
    internship: Colors.warning,
  }
  return (
    <View style={[styles.tag, { backgroundColor: colors[type] + '20', borderColor: colors[type] + '40' }]}>
      <Text style={[styles.tagText, { color: colors[type] }]}>{labels[type]}</Text>
    </View>
  )
}

function JobCard({ job, onPress, t }: { job: Job; onPress: () => void; t: (k: string) => string }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>{job.title}</Text>
        <JobTypeTag type={job.jobType} t={t} />
      </View>
      <Text style={styles.providerName}>{job.providerName}</Text>
      <Text style={styles.location}>📍 {job.location}</Text>
      {(job.salaryMin || job.salaryMax) && (
        <Text style={styles.salary}>
          💰 {job.salaryMin ? String(job.salaryMin) : '?'} – {job.salaryMax ? String(job.salaryMax) : '?'} {job.currency ?? 'SAR'}
        </Text>
      )}
      <Text style={styles.description} numberOfLines={2}>{job.description}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.applicationsCount}>
          {job.applicationsCount} {t('jobs.applications')}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

export default function JobsListScreen() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const insets   = useSafeAreaInsets()
  const { jobs, jobsLoading, loadJobs } = useJobsStore()

  useEffect(() => { void loadJobs() }, [])

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.headerTitle}>{t('jobs.title')}</Text>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={j => j.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={jobsLoading} onRefresh={loadJobs} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          jobsLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
          ) : (
            <EmptyState emoji="💼" title={t('jobs.noJobs')} subtitle={t('jobs.noJobsDesc')} />
          )
        }
        renderItem={({ item }) => (
          <JobCard
            job={item}
            t={t}
            onPress={() => router.push(`/jobs/${item.id}`)}
          />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gray900 },
  list: { padding: Spacing.md, gap: Spacing.md },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  cardTitle: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray900 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  tagText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  providerName: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  location: { fontSize: FontSize.sm, color: Colors.gray500 },
  salary: { fontSize: FontSize.sm, color: Colors.success },
  description: { fontSize: FontSize.sm, color: Colors.gray500, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.xs },
  applicationsCount: { fontSize: FontSize.xs, color: Colors.gray400 },
})
