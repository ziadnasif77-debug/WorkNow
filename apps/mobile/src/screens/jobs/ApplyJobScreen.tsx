// ─────────────────────────────────────────────────────────────────────────────
// Apply Job Screen — application form with CV upload
// CV upload supports: PDF, DOC, DOCX (common CV formats)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as DocumentPicker from 'expo-document-picker'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { firebaseStorage, firebaseAuth } from '../../lib/firebase'
import { useJobsStore } from '../../stores/jobsStore'
import { useAuthStore } from '../../stores/authStore'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'

// Accepted CV MIME types and extensions
const CV_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export default function ApplyJobScreen() {
  const { t }        = useTranslation()
  const router       = useRouter()
  const { jobId, jobTitle } = useLocalSearchParams<{ jobId: string; jobTitle: string }>()
  const appUser      = useAuthStore(s => s.appUser)
  const { applyToJob, actionLoading } = useJobsStore()

  const [name,      setName]      = useState(appUser?.displayName ?? '')
  const [email,     setEmail]     = useState(appUser?.email ?? '')
  const [phone,     setPhone]     = useState(appUser?.phone ?? '')
  const [coverNote, setCoverNote] = useState('')
  const [cvUri,     setCvUri]     = useState<string | null>(null)
  const [cvName,    setCvName]    = useState<string | null>(null)
  const [cvUrl,     setCvUrl]     = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // ── CV file picker ─────────────────────────────────────────────────────────
  async function pickCV() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: CV_MIME_TYPES,
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      setCvUri(asset.uri)
      setCvName(asset.name)
      setCvUrl(null) // reset uploaded URL — needs re-upload

      // Upload immediately after picking
      await uploadCV(asset.uri, asset.name, asset.mimeType ?? 'application/pdf')
    } catch {
      Alert.alert(t('common.error'), t('errors.uploadFailed'))
    }
  }

  async function uploadCV(uri: string, fileName: string, mimeType: string) {
    const uid = firebaseAuth.currentUser?.uid
    if (!uid) return
    setUploading(true)
    try {
      const ext  = fileName.split('.').pop() ?? 'pdf'
      const path = `cvs/${uid}/${Date.now()}.${ext}`
      const blob = await fetch(uri).then(r => r.blob())
      const storageRef = ref(firebaseStorage, path)
      await uploadBytes(storageRef, blob, { contentType: mimeType })
      const url = await getDownloadURL(storageRef)
      setCvUrl(url)
    } catch {
      Alert.alert(t('common.error'), t('errors.uploadFailed'))
      setCvUri(null)
      setCvName(null)
    } finally {
      setUploading(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('jobs.fullName') + ' ' + t('common.error'))
      return
    }
    if (!email.trim()) {
      Alert.alert(t('common.error'), t('jobs.email') + ' ' + t('common.error'))
      return
    }
    if (!phone.trim()) {
      Alert.alert(t('common.error'), t('jobs.phone') + ' ' + t('common.error'))
      return
    }

    try {
      await applyToJob({
        jobId:          jobId!,
        applicantName:  name.trim(),
        applicantEmail: email.trim(),
        applicantPhone: phone.trim(),
        coverNote:      coverNote.trim() || undefined,
        cvUrl:          cvUrl ?? undefined,
        cvFileName:     cvName ?? undefined,
      })
      Alert.alert(t('jobs.applicationSent'), t('jobs.applicationSentDesc'), [
        { text: t('common.done'), onPress: () => router.back() },
      ])
    } catch {
      // error already set in store
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('jobs.applyTitle')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Job title display */}
        <View style={styles.jobBanner}>
          <Text style={styles.jobBannerLabel}>{t('jobs.applyTitle')}</Text>
          <Text style={styles.jobBannerTitle} numberOfLines={2}>{jobTitle}</Text>
          <Text style={styles.jobBannerSub}>{t('jobs.applySubtitle')}</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Field label={t('jobs.fullName')} value={name} onChangeText={setName} placeholder="..." />
          <Field label={t('jobs.email')} value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label={t('jobs.phone')} value={phone} onChangeText={setPhone} placeholder="+966 5X XXX XXXX" keyboardType="phone-pad" />
          <Field
            label={t('jobs.coverNote')} value={coverNote} onChangeText={setCoverNote}
            placeholder={t('jobs.coverNotePlaceholder')} multiline
          />
        </View>

        {/* CV Upload */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{t('jobs.uploadCV')}</Text>
          <Text style={styles.cvTypesHint}>{t('jobs.cvTypes')}</Text>

          <TouchableOpacity
            style={[styles.cvButton, cvUrl && styles.cvButtonDone]}
            onPress={pickCV}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator color={Colors.white} />
            ) : cvUrl ? (
              <Text style={styles.cvButtonText}>✓ {cvName ?? t('jobs.cvUploaded')}</Text>
            ) : (
              <Text style={styles.cvButtonText}>📎 {t('jobs.uploadCV')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (actionLoading || uploading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={actionLoading || uploading}
          activeOpacity={0.85}
        >
          {actionLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>{t('jobs.submitApplication')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function Field({
  label, value, onChangeText, placeholder,
  multiline, keyboardType, autoCapitalize,
}: {
  label: string; value: string; onChangeText: (v: string) => void
  placeholder?: string; multiline?: boolean
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
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
  container:       { flex: 1, backgroundColor: Colors.background },
  content:         { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  jobBanner:       { backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.xs },
  jobBannerLabel:  { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  jobBannerTitle:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gray900 },
  jobBannerSub:    { fontSize: FontSize.sm, color: Colors.gray500 },
  card:            { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md, ...Shadow.sm },
  fieldWrap:       { gap: Spacing.xs },
  fieldLabel:      { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.gray700 },
  input:           { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.gray900, backgroundColor: Colors.white },
  inputMulti:      { height: 100, paddingTop: Spacing.sm },
  cvTypesHint:     { fontSize: FontSize.xs, color: Colors.gray400 },
  cvButton:        { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  cvButtonDone:    { backgroundColor: Colors.success },
  cvButtonText:    { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  submitBtn:       { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText:   { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
})
