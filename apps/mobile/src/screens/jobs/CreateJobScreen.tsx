// ─────────────────────────────────────────────────────────────────────────────
// Create Job Screen — provider posts a new job opening
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useJobsStore } from '../../stores/jobsStore'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'
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
        <View style={styles.card}>
          <Field label={t('jobs.titleLabel')} value={title} onChangeText={setTitle} placeholder={t('jobs.titlePlaceholder')} />
          <Field label={t('jobs.location')} value={location} onChangeText={setLocation} placeholder="مثال: الرياض، حي النخيل" />
          <Field
            label={t('jobs.descriptionLabel')} value={description} onChangeText={setDescription}
            placeholder={t('jobs.descriptionPlaceholder')} multiline
          />
          <Field
            label={t('jobs.requirements')} value={requirements} onChangeText={setRequirements}
            placeholder="مثال: خبرة 2 سنوات، إجادة JavaScript..." multiline
          />
        </View>

        {/* Job type */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{t('jobs.jobType')}</Text>
          <View style={styles.typeRow}>
            {JOB_TYPES.map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.typeChip, jobType === type && styles.typeChipActive]}
                onPress={() => setJobType(type)}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeChipText, jobType === type && styles.typeChipTextActive]}>
                  {jobTypeLabels[type]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Salary range */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{t('jobs.salaryRange')}</Text>
          <View style={styles.salaryRow}>
            <TextInput
              style={[styles.input, styles.salaryInput]}
              value={salaryMin}
              onChangeText={setSalaryMin}
              placeholder={t('jobs.salaryMin')}
              placeholderTextColor={Colors.gray300}
              keyboardType="numeric"
            />
            <Text style={styles.salarySep}>—</Text>
            <TextInput
              style={[styles.input, styles.salaryInput]}
              value={salaryMax}
              onChangeText={setSalaryMax}
              placeholder={t('jobs.salaryMax')}
              placeholderTextColor={Colors.gray300}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* External website */}
        <View style={styles.card}>
          <Field
            label={t('jobs.websiteLabel')} value={websiteUrl} onChangeText={setWebsiteUrl}
            placeholder={t('jobs.websitePlaceholder')} keyboardType="url" autoCapitalize="none"
          />
          <Text style={styles.websiteHint}>
            إذا أضفت رابطاً، سيُوجَّه المتقدمون لموقعك مباشرةً بدلاً من النموذج الداخلي
          </Text>
        </View>

        {actionError && <Text style={styles.errorText}>{actionError}</Text>}

        <TouchableOpacity
          style={[styles.publishBtn, actionLoading && styles.publishBtnDisabled]}
          onPress={handlePublish}
          disabled={actionLoading}
          activeOpacity={0.85}
        >
          {actionLoading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.publishBtnText}>🚀 {t('jobs.publishJob')}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize }: {
  label: string; value: string; onChangeText: (v: string) => void
  placeholder?: string; multiline?: boolean
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url' | 'numeric'
  autoCapitalize?: 'none' | 'sentences'
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.gray300}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.background },
  content:        { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  card:           { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md, ...Shadow.sm },
  fieldWrap:      { gap: Spacing.xs },
  fieldLabel:     { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.gray700 },
  input:          { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.gray900 },
  inputMulti:     { height: 100, paddingTop: Spacing.sm },
  typeRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeChip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText:   { fontSize: FontSize.sm, color: Colors.gray700, fontWeight: FontWeight.medium },
  typeChipTextActive: { color: Colors.white },
  salaryRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  salaryInput:    { flex: 1 },
  salarySep:      { fontSize: FontSize.lg, color: Colors.gray400 },
  websiteHint:    { fontSize: FontSize.xs, color: Colors.gray400, lineHeight: 18 },
  errorText:      { fontSize: FontSize.sm, color: Colors.error, textAlign: 'center' },
  publishBtn:     { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  publishBtnDisabled: { opacity: 0.5 },
  publishBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
})
