// ─────────────────────────────────────────────────────────────────────────────
// Job Detail Screen — view full job info + apply button
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Linking,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useJobsStore } from '../../stores/jobsStore'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Button, Badge, Card, InfoRow, FooterCTA, LoadingState } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'
import type { Job } from '@workfix/types'

export default function JobDetailScreen() {
  const { t }     = useTranslation()
  const router    = useRouter()
  const { id }    = useLocalSearchParams<{ id: string }>()
  const { activeJob, jobLoading, loadJobDetail } = useJobsStore()
  useEffect(() => {
    if (id) void loadJobDetail(id)
  }, [id])

  const job = activeJob

  const jobTypeLabel: Record<Job['jobType'], string> = {
    full_time:  t('jobs.fullTime'),
    part_time:  t('jobs.partTime'),
    freelance:  t('jobs.freelance'),
    internship: t('jobs.internship'),
  }

  if (jobLoading || !job) {
    return (
      <View style={styles.center}>
        <LoadingState style={{ marginTop: 0 }} />
      </View>
    )
  }

  function handleApply() {
    if (job?.websiteUrl) {
      void Linking.openURL(job.websiteUrl)
    } else {
      router.push({ pathname: '/jobs/apply', params: { jobId: job!.id, jobTitle: job!.title } })
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('jobs.jobDetails')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header card */}
        <Card>
          <Text style={styles.title}>{job.title}</Text>
          <Text style={styles.providerName}>{job.providerName}</Text>

          <View style={styles.chips}>
            <Badge label={jobTypeLabel[job.jobType]} variant="primary" />
            {job.status !== 'open' && (
              <Badge label={t(`jobs.status_${job.status}`)} variant="error" />
            )}
          </View>
        </Card>

        {/* Details */}
        <Card>
          <InfoRow label={`📍 ${t('jobs.location')}`} value={job.location} />
          {(job.salaryMin || job.salaryMax) && (
            <InfoRow
              label={`💰 ${t('jobs.salary')}`}
              value={`${job.salaryMin ?? '?'} – ${job.salaryMax ?? '?'} ${job.currency ?? 'SAR'}`}
            />
          )}
          {job.applicationDeadline && (
            <InfoRow
              label={`📅 ${t('jobs.deadline')}`}
              value={new Date(job.applicationDeadline.seconds * 1000).toLocaleDateString()}
            />
          )}
          {job.applicationsCount > 0 && (
            <InfoRow
              label={`👥 ${t('jobs.applications')}`}
              value={String(job.applicationsCount)}
            />
          )}
        </Card>

        {/* Description */}
        <Card>
          <Text style={styles.sectionTitle}>{t('jobs.descriptionLabel')}</Text>
          <Text style={styles.body}>{job.description}</Text>
        </Card>

        {/* Requirements */}
        {job.requirements ? (
          <Card>
            <Text style={styles.sectionTitle}>{t('jobs.requirements')}</Text>
            <Text style={styles.body}>{job.requirements}</Text>
          </Card>
        ) : null}
      </ScrollView>

      {/* Apply button */}
      {job.status === 'open' && (
        <FooterCTA>
          {job.websiteUrl ? (
            <Button label={`🌐 ${t('jobs.applyViaWebsite')}`} onPress={handleApply} />
          ) : (
            <Button label={t('jobs.applyNow')} onPress={handleApply} />
          )}
        </FooterCTA>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:      { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  title:        { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gray900 },
  providerName: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.medium },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray900 },
  body:         { fontSize: FontSize.sm, color: Colors.gray700, lineHeight: 22 },
})
