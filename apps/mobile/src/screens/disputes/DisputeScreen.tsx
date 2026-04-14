// ─────────────────────────────────────────────────────────────────────────────
// Dispute Screen — open a dispute on a completed order
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Alert, ScrollView,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as ImagePicker from 'expo-image-picker'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Analytics } from '../../lib/analytics'
import { useOrdersStore } from '../../stores/ordersStore'
import { firebaseFunctions, firebaseAuth } from '../../lib/firebase'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Button, Input, Radio, Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize } from '../../constants/theme'

const DISPUTE_REASONS = [
  { key: 'not_completed',    ar: 'لم تُنجز الخدمة',        en: 'Service not completed' },
  { key: 'poor_quality',     ar: 'جودة العمل سيئة',        en: 'Poor quality work' },
  { key: 'overcharged',      ar: 'تحصيل زائد عن المتفق',   en: 'Overcharged' },
  { key: 'damage',           ar: 'تسبّب في أضرار',         en: 'Caused damage' },
  { key: 'no_show',          ar: 'لم يحضر المزوّد',        en: 'Provider no-show' },
  { key: 'other',            ar: 'سبب آخر',                en: 'Other' },
]

export default function DisputeScreen() {
  const { t, i18n } = useTranslation()
  const router      = useRouter()
  const { orderId } = useLocalSearchParams<{ orderId: string }>()

  const lang = (i18n.language === 'ar' ? 'ar' : 'en') as 'ar' | 'en'

  const [reason,       setReason]       = useState('')
  const [description,  setDescription]  = useState('')
  const [evidence,     setEvidence]     = useState<string[]>([])
  const { openDispute, actionLoading }  = useOrdersStore()
  const [isLoading,    setIsLoading]    = useState(false)
  const [uploading,    setUploading]    = useState(false)

  async function pickEvidence() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 3,
      quality: 0.7,
    })
    if (!result.canceled) {
      setEvidence(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 3))
    }
  }

  async function uploadEvidence(): Promise<string[]> {
    const uid     = firebaseAuth.currentUser?.uid ?? 'anon'
    const storage = getStorage()
    const urls: string[] = []
    for (let i = 0; i < evidence.length; i++) {
      const uri  = evidence[i]!
      const resp = await fetch(uri)
      const blob = await resp.blob()
      const r    = ref(storage, `orders/${orderId}/dispute/${Date.now()}_${i}.jpg`)
      await uploadBytes(r, blob)
      urls.push(await getDownloadURL(r))
    }
    return urls
  }

  async function handleSubmit() {
    if (!orderId) return
    if (!reason) {
      Alert.alert(t('disputes.selectReason'))
      return
    }
    if (description.trim().length < 20) {
      Alert.alert(t('disputes.descriptionTooShort'))
      return
    }

    setUploading(true)
    let evidenceUrls: string[] = []
    try {
      evidenceUrls = await uploadEvidence()
    } finally {
      setUploading(false)
    }

    setIsLoading(true)
    try {
      await openDispute({ orderId, reason, description: description.trim(), evidenceUrls })
      Analytics.disputeOpened(reason)
      Alert.alert(
        t('disputes.submitted'),
        t('disputes.submittedDesc'),
        [{ text: t('common.done'), onPress: () => router.replace({ pathname: '/orders/[id]', params: { id: orderId } }) }],
      )
    } catch {
      Alert.alert(t('common.error'), t('disputes.submitFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Screen scroll padded={false}>
      <ScreenHeader title={t('disputes.title')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Warning */}
        <View style={styles.warning_box}>
          <Text style={styles.warning_emoji}>⚠️</Text>
          <Text style={styles.warning_text}>{t('disputes.warningDesc')}</Text>
        </View>

        {/* Reason selection */}
        <Text style={styles.section_label}>{t('disputes.selectReasonLabel')}</Text>
        <View style={styles.reasons_list}>
          {DISPUTE_REASONS.map(r => (
            <TouchableOpacity
              key={r.key}
              style={[styles.reason_row, reason === r.key && styles.reason_row_active]}
              onPress={() => setReason(r.key)}
            >
              <Radio selected={reason === r.key} />
              <Text style={[styles.reason_label, reason === r.key && styles.reason_label_active]}>
                {r[lang]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <Input
          label={t('disputes.descriptionLabel')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('disputes.descriptionPlaceholder')}
          multiline
          hint={t('disputes.descriptionHint')}
          containerStyle={styles.desc_input}
        />

        {/* Evidence */}
        <Text style={styles.section_label}>{t('disputes.evidence')}</Text>
        <Text style={styles.section_hint}>{t('disputes.evidenceHint')}</Text>
        <View style={styles.evidence_grid}>
          {evidence.map((uri, i) => (
            <View key={i} style={styles.evidence_thumb}>
              <Image source={{ uri }} style={styles.evidence_img} />
              <TouchableOpacity
                style={styles.evidence_remove}
                onPress={() => setEvidence(e => e.filter((_, j) => j !== i))}
              >
                <Text style={styles.evidence_remove_text}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {evidence.length < 3 && (
            <TouchableOpacity style={styles.evidence_add} onPress={pickEvidence}>
              <Text style={styles.evidence_add_icon}>📷</Text>
              <Text style={styles.evidence_add_label}>{t('disputes.addEvidence')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Button
          label={t('disputes.submit')}
          onPress={handleSubmit}
          isLoading={isLoading || uploading}
          disabled={!reason || description.trim().length < 20}
          style={styles.submit_btn}
        />

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg },

  warning_box: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.warningLight, borderRadius: Radius.md, padding: Spacing.md,
  },
  warning_emoji: { fontSize: IconSize.md },
  warning_text:  { flex: 1, fontSize: FontSize.sm, color: Colors.warning, lineHeight: 20 },

  section_label: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  section_hint:  { fontSize: FontSize.sm, color: Colors.gray500, marginTop: -Spacing.sm },

  reasons_list: { gap: Spacing.sm },
  reason_row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  reason_row_active: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  reason_label:      { flex: 1, fontSize: FontSize.md, color: Colors.gray700 },
  reason_label_active: { color: Colors.primary, fontWeight: FontWeight.medium },

  desc_input: { marginTop: 0 },

  evidence_grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  evidence_thumb: { width: 90, height: 90, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  evidence_img:   { width: '100%', height: '100%' },
  evidence_remove: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: Radius.full,
    backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center',
  },
  evidence_remove_text: { color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold },
  evidence_add: {
    width: 90, height: 90, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
  },
  evidence_add_icon:  { fontSize: IconSize.lg },
  evidence_add_label: { fontSize: FontSize.xs, color: Colors.gray400 },

  submit_btn: {},
})
