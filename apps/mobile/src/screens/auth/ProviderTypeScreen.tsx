// ─────────────────────────────────────────────────────────────────────────────
// Provider Type Screen — individual / company + KYC document upload
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as ImagePicker from 'expo-image-picker'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { useAuthStore } from '../../stores/authStore'
import { firebaseFunctions } from '../../lib/firebase'
import { Button, Input, Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'
import { firebaseAuth } from '../../lib/firebase'
import type { ProviderType } from '@workfix/types'

type Step = 'type' | 'kyc' | 'pending'

export default function ProviderTypeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { setProviderType, isLoading, error, clearError } = useAuthStore()

  const [step,         setStep]         = useState<Step>('type')
  const [type,         setType]         = useState<ProviderType>('individual')
  const [businessName, setBusinessName] = useState('')
  const [documents,    setDocuments]    = useState<string[]>([])   // local URIs
  const [uploading,    setUploading]    = useState(false)

  async function pickDocument() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 3,
    })
    if (!result.canceled) {
      setDocuments(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 3))
    }
  }

  async function uploadAndSubmit() {
    if (documents.length === 0) {
      Alert.alert(t('auth.kycTitle'), t('errors.kycRequired'))
      return
    }
    clearError()
    setUploading(true)

    try {
      const uid = firebaseAuth.currentUser?.uid
      if (!uid) throw new Error('Not authenticated')

      const storage = getStorage()
      const urls: string[] = []

      for (let i = 0; i < documents.length; i++) {
        const uri  = documents[i]!
        const resp = await fetch(uri)
        const blob = await resp.blob()
        const fileRef = ref(storage, `kyc/${uid}/doc_${i}_${Date.now()}.jpg`)
        await uploadBytes(fileRef, blob)
        const url = await getDownloadURL(fileRef)
        urls.push(url)
      }

      // Submit KYC documents to backend (stores URLs + creates admin review task)
      const uploadKyc = httpsCallable<{ documentUrls: string[] }, { ok: boolean }>(
        firebaseFunctions, 'uploadKyc',
      )
      await uploadKyc({ documentUrls: urls })

      await setProviderType(type, businessName || undefined)
      setStep('pending')
    } catch {
      Alert.alert(t('common.error'), t('errors.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  // ── Step: Type selection ──────────────────────────────────────────────────

  if (step === 'type') {
    return (
      <Screen scroll>
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.providerTypeTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.providerTypeSubtitle')}</Text>
        </View>

        <View style={styles.type_cards}>
          {([
            { key: 'individual', emoji: '👨‍🔧', label: t('auth.individual'), desc: t('auth.individualDesc') },
            { key: 'company',    emoji: '🏢', label: t('auth.company'),    desc: t('auth.companyDesc')    },
          ] as const).map(tp => (
            <TouchableOpacity
              key={tp.key}
              style={[styles.type_card, type === tp.key && styles.type_card_active]}
              onPress={() => setType(tp.key)}
              activeOpacity={0.85}
            >
              <Text style={styles.type_emoji}>{tp.emoji}</Text>
              <View style={styles.type_text}>
                <Text style={[styles.type_label, type === tp.key && styles.type_label_active]}>
                  {tp.label}
                </Text>
                <Text style={styles.type_desc}>{tp.desc}</Text>
              </View>
              <View style={[styles.radio, type === tp.key && styles.radio_active]}>
                {type === tp.key && <View style={styles.radio_inner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {type === 'company' && (
          <Input
            label={t('auth.businessName')}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder={t('auth.businessNamePlaceholder')}
            containerStyle={styles.business_input}
          />
        )}

        <Button
          label={t('common.next')}
          onPress={() => setStep('kyc')}
          disabled={type === 'company' && businessName.trim().length < 2}
          style={styles.btn}
        />
      </Screen>
    )
  }

  // ── Step: KYC Upload ──────────────────────────────────────────────────────

  if (step === 'kyc') {
    return (
      <Screen scroll>
        <TouchableOpacity onPress={() => setStep('type')} style={styles.back}>
          <Text style={styles.back_text}>← {t('common.back')}</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.kycTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.kycDesc')}</Text>
        </View>

        {/* Document thumbnails */}
        <View style={styles.docs_grid}>
          {documents.map((uri, i) => (
            <View key={i} style={styles.doc_thumb}>
              <Image source={{ uri }} style={styles.doc_img} />
              <TouchableOpacity
                style={styles.doc_remove}
                onPress={() => setDocuments(d => d.filter((_, j) => j !== i))}
              >
                <Text style={styles.doc_remove_text}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {documents.length < 3 && (
            <TouchableOpacity style={styles.doc_add} onPress={pickDocument}>
              <Text style={styles.doc_add_icon}>+</Text>
              <Text style={styles.doc_add_label}>{t('auth.addDocument')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.kyc_hints}>
          {[t('auth.kycHint1'), t('auth.kycHint2'), t('auth.kycHint3')].map((h, i) => (
            <View key={i} style={styles.kyc_hint_row}>
              <Text style={styles.kyc_hint_dot}>•</Text>
              <Text style={styles.kyc_hint_text}>{h}</Text>
            </View>
          ))}
        </View>

        {error && (
          <View style={styles.error_box}>
            <Text style={styles.error_text}>{error}</Text>
          </View>
        )}

        <Button
          label={t('auth.submitKyc')}
          onPress={uploadAndSubmit}
          isLoading={isLoading || uploading}
          disabled={documents.length === 0}
          style={styles.btn}
        />
      </Screen>
    )
  }

  // ── Step: Pending ─────────────────────────────────────────────────────────

  return (
    <Screen>
      <View style={styles.pending_container}>
        <Text style={styles.pending_emoji}>⏳</Text>
        <Text style={styles.pending_title}>{t('auth.kycPendingTitle')}</Text>
        <Text style={styles.pending_body}>{t('auth.kycPending')}</Text>
        <Button
          label={t('auth.goToHome')}
          onPress={() => router.replace('/(tabs)')}
          style={{ marginTop: Spacing.xl }}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: 8 },
  title:   { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },
  subtitle: { fontSize: FontSize.md, color: Colors.gray500, lineHeight: 22 },

  type_cards:      { gap: Spacing.md, marginBottom: Spacing.lg },
  type_card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, ...Shadow.sm,
  },
  type_card_active: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  type_emoji: { fontSize: 32 },
  type_text:  { flex: 1 },
  type_label: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },
  type_label_active: { color: Colors.primary },
  type_desc:  { fontSize: FontSize.sm, color: Colors.gray500, marginTop: 2 },

  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  radio_active: { borderColor: Colors.primary },
  radio_inner:  { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  business_input: { marginBottom: Spacing.md },
  btn: { marginTop: Spacing.sm },

  back:      { paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  back_text: { color: Colors.primary, fontSize: FontSize.md },

  docs_grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  doc_thumb: { width: 100, height: 120, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  doc_img:   { width: '100%', height: '100%' },
  doc_remove: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  doc_remove_text: { color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold },
  doc_add: {
    width: 100, height: 120, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  doc_add_icon:  { fontSize: 28, color: Colors.gray400 },
  doc_add_label: { fontSize: FontSize.xs, color: Colors.gray400 },

  kyc_hints: { gap: 6, marginBottom: Spacing.lg },
  kyc_hint_row: { flexDirection: 'row', gap: 6 },
  kyc_hint_dot: { color: Colors.primary, fontSize: FontSize.md },
  kyc_hint_text: { flex: 1, fontSize: FontSize.sm, color: Colors.gray500 },

  error_box: {
    backgroundColor: Colors.errorLight, borderRadius: Radius.sm,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  error_text: { color: Colors.error, fontSize: FontSize.sm },

  pending_container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  pending_emoji: { fontSize: 72, marginBottom: Spacing.lg },
  pending_title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black, textAlign: 'center', marginBottom: Spacing.md },
  pending_body:  { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center', lineHeight: 24 },
})
