// ─────────────────────────────────────────────────────────────────────────────
// Create Job Screen — provider posts a new job opening
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useJobsStore } from '../../stores/jobsStore'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Button, Card, Chip, ErrorBanner, Input } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'
import type { Job } from '@workfix/types'

const JOB_TYPES: Job['jobType'][] = ['full_time', 'part_time', 'freelance', 'internship']

export default function CreateJobScreen() {
  const { t }      = useTranslation()
  const router     = useRouter()
  const { createJob, actionLoading, actionError } = useJobsStore()

  const [title,        setTitle]        = useState('')
  const [description,  setDescription]  = useState('')
  const [location,     setLocation]     = useState('')
  const [jobType,      setJobType]      = useState<Job['jobType']>('full_time')
  const [requirements, setRequirements] = useState('')
  const [salaryMin,    setSalaryMin]    = useState('')
  const [salaryMax,    setSalaryMax]    = useState('')
  const [websiteUrl,   setWebsiteUrl]   = useState('')

  async function handlePublish() {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('jobs.titleLabel'))
      return
    }
    if (!description.trim() || description.length < 20) {
      Alert.alert(t('common.error'), t('jobs.descriptionLabel'))
      return
    }
    if (!location.trim()) {
      Alert.alert(t('common.error'), t('jobs.location'))
      return
    }

    try {
      await createJob({
        title:        title.trim(),
        description:  description.trim(),
        jobType,
        location:     location.trim(),
        requirements: requirements.trim() || undefined,
        salaryMin:    salaryMin ? Number(salaryMin) : undefined,
        salaryMax:    salaryMax ? Number(salaryMax) : undefined,
        websiteUrl:   websiteUrl.trim() || undefined,
      })
      Alert.alert(t('jobs.jobPublished'), '', [
        { text: t('common.done'), onPress: () => router.back() },
      ])
    } catch {
      // error displayed from store
    }
  }

  const jobTypeLabels: Record<Job['jobType'], string> = {
    full_time:  t('jobs.fullTime'),
    part_time:  t('jobs.partTime'),
    freelance:  t('jobs.freelance'),
    internship: t('jobs.internship'),
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('jobs.createJob')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Basic info */}
        <Card gap={Spacing.md}>
          <Input label={t('jobs.titleLabel')} value={title} onChangeText={setTitle} placeholder={t('jobs.titlePlaceholder')} containerStyle={{ marginBottom: 0 }} />
          <Input label={t('jobs.location')} value={location} onChangeText={setLocation} placeholder="مثال: الرياض، حي النخيل" containerStyle={{ marginBottom: 0 }} />
          <Input
            label={t('jobs.descriptionLabel')} value={description} onChangeText={setDescription}
            placeholder={t('jobs.descriptionPlaceholder')} multiline
            style={{ height: 100, textAlignVertical: 'top', paddingTop: Spacing.sm }}
            containerStyle={{ marginBottom: 0 }}
          />
          <Input
            label={t('jobs.requirements')} value={requirements} onChangeText={setRequirements}
            placeholder="مثال: خبرة 2 سنوات، إجادة JavaScript..." multiline
            style={{ height: 100, textAlignVertical: 'top', paddingTop: Spacing.sm }}
            containerStyle={{ marginBottom: 0 }}
          />
        </Card>

        {/* Job type */}
        <Card gap={Spacing.md}>
          <Text style={styles.field_label}>{t('jobs.jobType')}</Text>
          <View style={styles.type_row}>
            {JOB_TYPES.map(type => (
              <Chip
                key={type}
                label={jobTypeLabels[type]}
                selected={jobType === type}
                onPress={() => setJobType(type)}
              />
            ))}
          </View>
        </Card>

        {/* Salary range */}
        <Card gap={Spacing.md}>
          <Text style={styles.field_label}>{t('jobs.salaryRange')}</Text>
          <View style={styles.salary_row}>
            <Input
              value={salaryMin}
              onChangeText={setSalaryMin}
              placeholder={t('jobs.salaryMin')}
              keyboardType="numeric"
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            <Text style={styles.salary_sep}>—</Text>
            <Input
              value={salaryMax}
              onChangeText={setSalaryMax}
              placeholder={t('jobs.salaryMax')}
              keyboardType="numeric"
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
          </View>
        </Card>

        {/* External website */}
        <Card gap={Spacing.md}>
          <Input
            label={t('jobs.websiteLabel')} value={websiteUrl} onChangeText={setWebsiteUrl}
            placeholder={t('jobs.websitePlaceholder')} keyboardType="url" autoCapitalize="none"
            containerStyle={{ marginBottom: 0 }}
          />
          <Text style={styles.website_hint}>
            إذا أضفت رابطاً، سيُوجَّه المتقدمون لموقعك مباشرةً بدلاً من النموذج الداخلي
          </Text>
        </Card>

        <ErrorBanner error={actionError} />

        <Button
          label={`🚀 ${t('jobs.publishJob')}`}
          onPress={handlePublish}
          isLoading={actionLoading}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  content:      { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  field_label:  { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.gray700 },
  type_row:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  salary_row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  salary_sep:   { fontSize: FontSize.lg, color: Colors.gray400 },
  website_hint: { fontSize: FontSize.xs, color: Colors.gray400, lineHeight: 18 },
})
