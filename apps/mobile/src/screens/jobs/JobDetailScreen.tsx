// ─────────────────────────────────────────────────────────────────────────────
// Job Detail Screen — view full job info + apply button
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useJobsStore } from '../../stores/jobsStore'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'
import { useAuthStore } from '../../stores/authStore'
import type { Job } from '@workfix/types'

function SectionRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

export default function JobDetailScreen() {
  const { t }     = useTranslation()
  const router    = useRouter()
  const { id }    = useLocalSearchParams<{ id: string }>()
  const { activeJob, jobLoading, loadJobDetail } = useJobsStore()
  const appUser   = useAuthStore(s => s.appUser)

  // Check if user already applied (simple local flag; a Cloud Function would do the authoritative check)
  const [hasApplied, setHasApplied] = useState(false)

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
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  function handleApply() {
    if (job?.websiteUrl) {
      // External application website
      void Linking.openURL(job.websiteUrl)
    } else {
      // In-app application form
      router.push({ pathname: '/jobs/apply', params: { jobId: job!.id, jobTitle: job!.title } })
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('jobs.jobDetails')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header card */}
        <View style={styles.card}>
          <Text style={styles.title}>{job.title}</Text>
          <Text style={styles.providerName}>{job.providerName}</Text>

          <View style={styles.chips}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{jobTypeLabel[job.jobType]}</Text>
            </View>
            {job.status !== 'open' && (
              <View style={[styles.chip, styles.chipClosed]}>
                <Text style={[styles.chipText, { color: Colors.error }]}>{t(`jobs.status_${job.status}`)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <SectionRow label={`📍 ${t('jobs.location')}`} value={job.location} />
          {(job.salaryMin || job.salaryMax) && (
            <SectionRow
              label={`💰 ${t('jobs.salary')}`}
              value={`${job.salaryMin ?? '?'} – ${job.salaryMax ?? '?'} ${job.currency ?? 'SAR'}`}
            />
          )}
          {job.applicationDeadline && (
            <SectionRow
              label={`📅 ${t('jobs.deadline')}`}
              value={new Date(job.applicationDeadline.seconds * 1000).toLocaleDateString()}
            />
          )}
          {job.applicationsCount > 0 && (
            <SectionRow
              label={`👥 ${t('jobs.applications')}`}
              value={String(job.applicationsCount)}
            />
          )}
        </View>

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('jobs.descriptionLabel')}</Text>
          <Text style={styles.body}>{job.description}</Text>
        </View>

        {/* Requirements */}
        {job.requirements ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('jobs.requirements')}</Text>
            <Text style={styles.body}>{job.requirements}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Apply button */}
      {job.status === 'open' && (
        <View style={styles.footer}>
          {job.websiteUrl ? (
            <TouchableOpacity style={styles.btn} onPress={handleApply} activeOpacity={0.85}>
              <Text style={styles.btnText}>🌐 {t('jobs.applyViaWebsite')}</Text>
            </TouchableOpacity>
          ) : hasApplied ? (
            <View style={[styles.btn, styles.btnDisabled]}>
              <Text style={styles.btnText}>✓ {t('jobs.applied')}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.btn} onPress={handleApply} activeOpacity={0.85}>
              <Text style={styles.btnText}>{t('jobs.applyNow')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.background },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:    { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  card:       { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm },
  title:      { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gray900 },
  providerName: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.medium },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip:       { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.primaryLight },
  chipClosed: { backgroundColor: Colors.errorLight },
  chipText:   { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  rowLabel:   { fontSize: FontSize.sm, color: Colors.gray500, flex: 1 },
  rowValue:   { fontSize: FontSize.sm, color: Colors.gray900, fontWeight: FontWeight.medium, flex: 2, textAlign: 'right' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray900 },
  body:       { fontSize: FontSize.sm, color: Colors.gray700, lineHeight: 22 },
  footer:     { padding: Spacing.md, paddingBottom: Spacing.lg, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
  btn:        { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  btnDisabled:{ backgroundColor: Colors.success },
  btnText:    { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
})
