// ─────────────────────────────────────────────────────────────────────────────
// Apply Job Screen — application form with CV upload
// CV upload supports: PDF, DOC, DOCX (common CV formats)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as DocumentPicker from 'expo-document-picker'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { firebaseStorage, firebaseAuth } from '../../lib/firebase'
import { useJobsStore } from '../../stores/jobsStore'
import { useAuthStore } from '../../stores/authStore'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Button, Card, Input } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme'

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
  const [_cvUri,    setCvUri]     = useState<string | null>(null)
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
        <View style={styles.job_banner}>
          <Text style={styles.job_banner_label}>{t('jobs.applyTitle')}</Text>
          <Text style={styles.job_banner_title} numberOfLines={2}>{jobTitle}</Text>
          <Text style={styles.job_banner_sub}>{t('jobs.applySubtitle')}</Text>
        </View>

        {/* Form */}
        <Card gap={Spacing.md}>
          <Input label={t('jobs.fullName')} value={name} onChangeText={setName} placeholder="..." containerStyle={{ marginBottom: 0 }} />
          <Input label={t('jobs.email')} value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" containerStyle={{ marginBottom: 0 }} />
          <Input label={t('jobs.phone')} value={phone} onChangeText={setPhone} placeholder="+966 5X XXX XXXX" keyboardType="phone-pad" containerStyle={{ marginBottom: 0 }} />
          <Input
            label={t('jobs.coverNote')} value={coverNote} onChangeText={setCoverNote}
            placeholder={t('jobs.coverNotePlaceholder')} multiline
            style={{ height: 100, textAlignVertical: 'top', paddingTop: Spacing.sm }}
            containerStyle={{ marginBottom: 0 }}
          />
        </Card>

        {/* CV Upload */}
        <Card gap={Spacing.md}>
          <Text style={styles.cv_types_hint}>{t('jobs.cvTypes')}</Text>
          <Button
            label={cvUrl ? `✓ ${cvName ?? t('jobs.cvUploaded')}` : `📎 ${t('jobs.uploadCV')}`}
            variant={cvUrl ? 'success' : 'primary'}
            onPress={pickCV}
            isLoading={uploading}
          />
        </Card>

        {/* Submit */}
        <Button
          label={t('jobs.submitApplication')}
          onPress={handleSubmit}
          isLoading={actionLoading || uploading}
          style={{ marginTop: Spacing.sm }}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.background },
  content:          { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  job_banner:       { backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.xs },
  job_banner_label: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  job_banner_title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gray900 },
  job_banner_sub:   { fontSize: FontSize.sm, color: Colors.gray500 },
  cv_types_hint:    { fontSize: FontSize.xs, color: Colors.gray400 },
})
