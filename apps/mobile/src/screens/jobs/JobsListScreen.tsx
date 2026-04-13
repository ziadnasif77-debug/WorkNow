// ─────────────────────────────────────────────────────────────────────────────
// Jobs List Screen — browse all open job postings
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useJobsStore } from '../../stores/jobsStore'
import { Badge, Card, EmptyState, LoadingState, TabHeader } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'
import type { Job } from '@workfix/types'

// Job type → badge colors (defined once, used via Badge variant="custom")
const JOB_TYPE_BG: Record<Job['jobType'], string> = {
  full_time:  Colors.primary + '20',
  part_time:  Colors.success + '20',
  freelance:  Colors.purple  + '20',
  internship: Colors.warning + '20',
}
const JOB_TYPE_COLOR: Record<Job['jobType'], string> = {
  full_time:  Colors.primary,
  part_time:  Colors.success,
  freelance:  Colors.purple,
  internship: Colors.warning,
}

function JobCard({ job, onPress, t }: { job: Job; onPress: () => void; t: (k: string) => string }) {
  const jobTypeLabel: Record<Job['jobType'], string> = {
    full_time:  t('jobs.fullTime'),
    part_time:  t('jobs.partTime'),
    freelance:  t('jobs.freelance'),
    internship: t('jobs.internship'),
  }

  return (
    <Card gap={Spacing.xs} onPress={onPress}>
      <View style={styles.card_header}>
        <Text style={styles.card_title} numberOfLines={2}>{job.title}</Text>
        <Badge
          variant="custom"
          bg={JOB_TYPE_BG[job.jobType]}
          color={JOB_TYPE_COLOR[job.jobType]}
          label={jobTypeLabel[job.jobType]}
        />
      </View>
      <Text style={styles.provider_name}>{job.providerName}</Text>
      <Text style={styles.location}>📍 {job.location}</Text>
      {(job.salaryMin || job.salaryMax) && (
        <Text style={styles.salary}>
          💰 {job.salaryMin ?? '?'} – {job.salaryMax ?? '?'} {job.currency ?? 'SAR'}
        </Text>
      )}
      <Text style={styles.description} numberOfLines={2}>{job.description}</Text>
      <View style={styles.card_footer}>
        <Text style={styles.applications_count}>
          {job.applicationsCount} {t('jobs.applications')}
        </Text>
      </View>
    </Card>
  )
}

export default function JobsListScreen() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const { jobs, jobsLoading, loadJobs } = useJobsStore()

  useEffect(() => { void loadJobs() }, [])

  return (
    <View style={styles.container}>
      <TabHeader title={t('jobs.title')} />

      <FlatList
        data={jobs}
        keyExtractor={j => j.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={jobsLoading} onRefresh={loadJobs} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          jobsLoading
            ? <LoadingState />
            : <EmptyState emoji="💼" title={t('jobs.noJobs')} subtitle={t('jobs.noJobsDesc')} />
        }
        renderItem={({ item }) => (
          <JobCard job={item} t={t} onPress={() => router.push(`/jobs/${item.id}`)} />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.background },
  list:               { padding: Spacing.md, gap: Spacing.md },
  card_header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  card_title:         { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray900 },
  provider_name:      { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  location:           { fontSize: FontSize.sm, color: Colors.gray500 },
  salary:             { fontSize: FontSize.sm, color: Colors.success },
  description:        { fontSize: FontSize.sm, color: Colors.gray500, lineHeight: 20 },
  card_footer:        { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.xs },
  applications_count: { fontSize: FontSize.xs, color: Colors.gray400 },
})
