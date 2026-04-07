// ─────────────────────────────────────────────────────────────────────────────
// Privacy Screen — GDPR / PDPL Data Rights
// Provides "Download my data" and "Delete account" flows.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput, Linking,
} from 'react-native'
import { useRouter }                from 'expo-router'
import { useTranslation }           from 'react-i18next'
import { httpsCallable }            from 'firebase/functions'
import { firebaseFunctions }        from '../../lib/firebase'
import { useAuth }                  from '../../hooks/useAuth'
import { ScreenHeader }             from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize,
         FontWeight, Radius, Shadow, IconSize } from '../../constants/theme'

// ── Cloud Function callables ──────────────────────────────────────────────────

const requestDataExportFn = httpsCallable<
  Record<string, never>,
  { status: 'queued' | 'ready'; downloadUrl: string | null; expiresAt: string; exportId: string }
>(firebaseFunctions, 'requestDataExport')

const requestAccountDeletionFn = httpsCallable<
  { confirmation: 'DELETE MY ACCOUNT'; reason?: string },
  { status: string; scheduledFor?: string; message: string; retentionNote?: string }
>(firebaseFunctions, 'requestAccountDeletion')

const cancelAccountDeletionFn = httpsCallable<
  Record<string, never>,
  { ok: boolean; status: string }
>(firebaseFunctions, 'cancelAccountDeletion')

// ─────────────────────────────────────────────────────────────────────────────

export default function PrivacyScreen() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const { user } = useAuth()

  // ── Export state ──────────────────────────────────────────────────────────
  const [exportLoading, setExportLoading]   = useState(false)
  const [exportStatus,  setExportStatus]    = useState<'idle'|'queued'|'ready'>('idle')
  const [downloadUrl,   setDownloadUrl]     = useState<string|null>(null)
  const [exportExpiry,  setExportExpiry]    = useState<string|null>(null)

  // ── Deletion state ─────────────────────────────────────────────────────────
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deleteStep,   setDeleteStep]   = useState<1|2|3>(1)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteConfirm,setDeleteConfirm]= useState('')
  const [deleteLoading,setDeleteLoading]= useState(false)
  const [deletionScheduled, setDeletionScheduled] = useState<string|null>(null)

  // ── Request data export ───────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setExportLoading(true)
    try {
      const res = await requestDataExportFn({})
      const { status, downloadUrl: url, expiresAt } = res.data
      setExportStatus(status)
      setDownloadUrl(url)
      setExportExpiry(expiresAt ? new Date(expiresAt).toLocaleDateString('ar-SA') : null)

      if (status === 'ready' && url) {
        Alert.alert(
          t('privacy.exportReady'),
          t('privacy.exportReadyDesc', { expiry: new Date(expiresAt).toLocaleDateString('ar-SA') }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('privacy.download'), onPress: () => void Linking.openURL(url) },
          ],
        )
      } else {
        Alert.alert(t('privacy.exportQueued'), t('privacy.exportQueuedDesc'))
      }
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.retry'))
    } finally {
      setExportLoading(false)
    }
  }, [t])

  // ── Request account deletion ──────────────────────────────────────────────
  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirm !== 'DELETE MY ACCOUNT') return
    setDeleteLoading(true)
    try {
      const res = await requestAccountDeletionFn({
        confirmation: 'DELETE MY ACCOUNT',
        reason:       deleteReason as never || undefined,
      })
      const { status, scheduledFor, message, retentionNote } = res.data

      setDeleteModalVisible(false)
      setDeletionScheduled(scheduledFor ?? null)

      Alert.alert(
        status === 'already_requested'
          ? t('privacy.deletionAlreadyRequested')
          : t('privacy.deletionScheduled'),
        [message, retentionNote].filter(Boolean).join('\n\n'),
        [{ text: t('common.confirm') }],
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.retry')
      Alert.alert(t('common.error'), msg)
    } finally {
      setDeleteLoading(false)
      setDeleteStep(1)
      setDeleteConfirm('')
      setDeleteReason('')
    }
  }, [deleteConfirm, deleteReason, t])

  // ── Cancel pending deletion ───────────────────────────────────────────────
  const handleCancelDeletion = useCallback(async () => {
    try {
      await cancelAccountDeletionFn({})
      setDeletionScheduled(null)
      Alert.alert(t('privacy.deletionCancelled'), t('privacy.deletionCancelledDesc'))
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.retry'))
    }
  }, [t])

  return (
    <View style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <ScreenHeader title={t('privacy.screenTitle')} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Intro ────────────────────────────────────────────────────── */}
        <View style={styles.intro_card}>
          <Text style={styles.intro_icon} aria-hidden>🔐</Text>
          <View style={styles.intro_body}>
            <Text style={styles.intro_title}>{t('privacy.introTitle')}</Text>
            <Text style={styles.intro_text}>{t('privacy.introText')}</Text>
          </View>
        </View>

        {/* ── Data Export ──────────────────────────────────────────────── */}
        <SectionCard
          icon="📥"
          title={t('privacy.exportTitle')}
          description={t('privacy.exportDesc')}
        >
          {exportStatus === 'ready' && downloadUrl ? (
            <ActionButton
              label={t('privacy.download')}
              variant="secondary"
              onPress={() => void Linking.openURL(downloadUrl)}
              hint={t('privacy.exportExpiresHint', { expiry: exportExpiry ?? '' })}
            />
          ) : exportStatus === 'queued' ? (
            <View style={styles.queued_badge}>
              <Text style={styles.queued_text}>
                ⏳ {t('privacy.exportQueuedBadge')}
              </Text>
            </View>
          ) : (
            <ActionButton
              label={t('privacy.requestExport')}
              variant="secondary"
              onPress={handleExport}
              loading={exportLoading}
              accessibilityHint={t('privacy.exportHint')}
            />
          )}
          <Text style={styles.detail_text}>{t('privacy.exportIncludesLabel')}</Text>
          <Text style={styles.detail_list}>{t('privacy.exportIncludes')}</Text>
        </SectionCard>

        {/* ── Account Deletion ─────────────────────────────────────────── */}
        <SectionCard
          icon="🗑️"
          title={t('privacy.deleteTitle')}
          description={t('privacy.deleteDesc')}
          danger
        >
          {deletionScheduled ? (
            <View>
              <View style={styles.warning_badge}>
                <Text style={styles.warning_icon} aria-hidden>⏳</Text>
                <Text style={styles.warning_text}>
                  {t('privacy.deletionPending', {
                    date: new Date(deletionScheduled).toLocaleDateString('ar-SA'),
                  })}
                </Text>
              </View>
              <ActionButton
                label={t('privacy.cancelDeletion')}
                variant="secondary"
                onPress={handleCancelDeletion}
                accessibilityHint={t('privacy.cancelDeletionHint')}
              />
            </View>
          ) : (
            <ActionButton
              label={t('privacy.requestDeletion')}
              variant="danger"
              onPress={() => setDeleteModalVisible(true)}
              accessibilityHint={t('privacy.deleteHint')}
            />
          )}
          <Text style={styles.retention_note}>{t('privacy.retentionNote')}</Text>
        </SectionCard>

        {/* ── Links ────────────────────────────────────────────────────── */}
        <SectionCard icon="📄" title={t('privacy.policiesTitle')}>
          <PolicyLink
            label={t('profile.privacy')}
            onPress={() => router.push('/support/privacy')}
          />
          <PolicyLink
            label={t('profile.terms')}
            onPress={() => router.push('/support/terms')}
          />
          <PolicyLink
            label={t('privacy.contactDPO')}
            onPress={() => void Linking.openURL('mailto:privacy@workfix.app')}
          />
        </SectionCard>

        <Text style={styles.legal_note}>{t('privacy.legalNote')}</Text>
      </ScrollView>

      {/* ── Account Deletion Modal ──────────────────────────────────────── */}
      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDeleteModalVisible(false)}
        accessibilityViewIsModal
      >
        <View style={styles.modal_overlay}>
          <View style={styles.modal_card}>

            {/* Step 1: Warning */}
            {deleteStep === 1 && (
              <>
                <Text style={styles.modal_title} accessibilityRole="header">
                  ⚠️ {t('privacy.deleteModalTitle')}
                </Text>
                <Text style={styles.modal_body}>{t('privacy.deleteModalWarning')}</Text>
                <View style={styles.modal_info}>
                  <Text style={styles.modal_info_label}>✅ {t('privacy.deleteWillDelete')}</Text>
                  <Text style={styles.modal_info_text}>{t('privacy.deleteWillDeleteItems')}</Text>
                  <Text style={[styles.modal_info_label, {marginTop: 12}]}>
                    🔒 {t('privacy.deleteWillKeep')}
                  </Text>
                  <Text style={styles.modal_info_text}>{t('privacy.deleteWillKeepItems')}</Text>
                </View>
                <View style={styles.modal_actions}>
                  <TouchableOpacity
                    style={styles.modal_cancel}
                    onPress={() => { setDeleteModalVisible(false); setDeleteStep(1) }}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.cancel')}
                  >
                    <Text style={styles.modal_cancel_text}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modal_next_danger}
                    onPress={() => setDeleteStep(2)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.modal_next_text}>{t('privacy.continueToDelete')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 2: Reason */}
            {deleteStep === 2 && (
              <>
                <Text style={styles.modal_title} accessibilityRole="header">
                  {t('privacy.reasonTitle')}
                </Text>
                {DELETION_REASONS.map(r => (
                  <TouchableOpacity
                    key={r.value}
                    style={[
                      styles.reason_btn,
                      deleteReason === r.value && styles.reason_btn_selected,
                    ]}
                    onPress={() => setDeleteReason(r.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={t(r.labelKey as never) as string}
                    accessibilityState={{ checked: deleteReason === r.value }}
                  >
                    <Text style={styles.reason_icon} aria-hidden>{r.emoji}</Text>
                    <Text style={[
                      styles.reason_label,
                      deleteReason === r.value && styles.reason_label_selected,
                    ]}>
                      {t(r.labelKey as never) as string}
                    </Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.modal_actions}>
                  <TouchableOpacity style={styles.modal_cancel} onPress={() => setDeleteStep(1)}
                    accessibilityRole="button" accessibilityLabel={t('common.back')}>
                    <Text style={styles.modal_cancel_text}>{t('common.back')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modal_next_danger, !deleteReason && styles.modal_next_disabled]}
                    onPress={() => deleteReason && setDeleteStep(3)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !deleteReason }}
                  >
                    <Text style={styles.modal_next_text}>{t('common.next')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 3: Confirm */}
            {deleteStep === 3 && (
              <>
                <Text style={styles.modal_title} accessibilityRole="header">
                  {t('privacy.confirmDeleteTitle')}
                </Text>
                <Text style={styles.modal_body}>
                  {t('privacy.confirmDeleteInstr')}
                </Text>
                <Text style={styles.confirm_phrase}>DELETE MY ACCOUNT</Text>
                <TextInput
                  style={styles.confirm_input}
                  placeholder="DELETE MY ACCOUNT"
                  value={deleteConfirm}
                  onChangeText={setDeleteConfirm}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  accessibilityLabel={t('privacy.typeConfirmation')}
                />
                <Text style={styles.grace_note}>
                  {t('privacy.gracePeriodNote')}
                </Text>
                <View style={styles.modal_actions}>
                  <TouchableOpacity style={styles.modal_cancel} onPress={() => setDeleteStep(2)}
                    accessibilityRole="button" accessibilityLabel={t('common.back')}>
                    <Text style={styles.modal_cancel_text}>{t('common.back')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modal_delete_final,
                      (deleteConfirm !== 'DELETE MY ACCOUNT' || deleteLoading) && styles.modal_next_disabled,
                    ]}
                    onPress={handleDeleteConfirm}
                    disabled={deleteConfirm !== 'DELETE MY ACCOUNT' || deleteLoading}
                    accessibilityRole="button"
                    accessibilityLabel={t('privacy.confirmDeleteBtn')}
                    accessibilityState={{ disabled: deleteConfirm !== 'DELETE MY ACCOUNT' }}
                  >
                    {deleteLoading
                      ? <ActivityIndicator color={Colors.white} />
                      : <Text style={styles.modal_delete_text}>{t('privacy.confirmDeleteBtn')}</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}

          </View>
        </View>
      </Modal>
    </View>
  )
}

// ── Helper components ─────────────────────────────────────────────────────────

function SectionCard({ icon, title, description, danger, children }: {
  icon: string; title: string; description?: string
  danger?: boolean; children: React.ReactNode
}) {
  return (
    <View style={[sectionStyles.card, danger && sectionStyles.danger_card]}>
      <View style={sectionStyles.header}>
        <Text style={sectionStyles.icon} aria-hidden>{icon}</Text>
        <Text style={[sectionStyles.title, danger && sectionStyles.danger_title]}>{title}</Text>
      </View>
      {description && <Text style={sectionStyles.desc}>{description}</Text>}
      <View style={sectionStyles.body}>{children}</View>
    </View>
  )
}

function ActionButton({ label, variant, onPress, loading, hint, accessibilityHint }: {
  label: string; variant: 'secondary' | 'danger'
  onPress: () => void; loading?: boolean; hint?: string; accessibilityHint?: string
}) {
  return (
    <TouchableOpacity
      style={[btnStyles.btn, variant === 'danger' ? btnStyles.danger : btnStyles.secondary]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!loading }}
    >
      {loading
        ? <ActivityIndicator color={variant === 'danger' ? Colors.white : Colors.primary} />
        : <Text style={[btnStyles.text, variant === 'danger' ? btnStyles.danger_text : btnStyles.secondary_text]}>
            {label}
          </Text>
      }
    </TouchableOpacity>
  )
}

function PolicyLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={linkStyles.row}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <Text style={linkStyles.label}>{label}</Text>
      <Text style={linkStyles.arrow} aria-hidden>›</Text>
    </TouchableOpacity>
  )
}

// ── Deletion reasons ──────────────────────────────────────────────────────────
const DELETION_REASONS = [
  { value: 'no_longer_using',  emoji: '🚶', labelKey: 'privacy.reason_no_longer_using' },
  { value: 'privacy_concerns', emoji: '🔒', labelKey: 'privacy.reason_privacy' },
  { value: 'found_alternative',emoji: '🔄', labelKey: 'privacy.reason_alternative' },
  { value: 'other',            emoji: '💬', labelKey: 'privacy.reason_other' },
]

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  content:      { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },
  intro_card:   {
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
    backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md,
  },
  intro_icon:   { fontSize: IconSize.xl, marginTop: 2 },
  intro_body:   { flex: 1, gap: 4 },
  intro_title:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  intro_text:   { fontSize: FontSize.sm, color: Colors.gray600, lineHeight: 20 },
  queued_badge: {
    backgroundColor: '#FEF3C7', borderRadius: Radius.sm,
    padding: Spacing.sm, alignItems: 'center',
  },
  queued_text:  { color: '#92400E', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  detail_text:  { fontSize: FontSize.xs, color: Colors.gray500, marginTop: Spacing.sm },
  detail_list:  { fontSize: FontSize.xs, color: Colors.gray600, lineHeight: 18 },
  warning_badge:{
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: '#FEF3C7', borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  warning_icon: { fontSize: IconSize.sm },
  warning_text: { flex: 1, fontSize: FontSize.sm, color: '#92400E', lineHeight: 20 },
  retention_note:{ fontSize: FontSize.xs, color: Colors.gray400, lineHeight: 18, marginTop: Spacing.sm },
  legal_note:   {
    fontSize: FontSize.xs, color: Colors.gray400, textAlign: 'center',
    lineHeight: 18, paddingTop: Spacing.md,
  },
  // Modal
  modal_overlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal_card:   {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.xl, gap: Spacing.md, maxHeight: '90%',
  },
  modal_title:  { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  modal_body:   { fontSize: FontSize.md, color: Colors.gray600, lineHeight: 22 },
  modal_info:   {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, gap: 4,
  },
  modal_info_label:{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.black },
  modal_info_text: { fontSize: FontSize.sm, color: Colors.gray600, lineHeight: 20 },
  modal_actions:{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  modal_cancel: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  modal_cancel_text:{ color: Colors.gray600, fontWeight: FontWeight.medium },
  modal_next_danger:{
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.error, alignItems: 'center',
  },
  modal_next_text:{ color: Colors.white, fontWeight: FontWeight.bold },
  modal_next_disabled:{ opacity: 0.4 },
  modal_delete_final:{
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: '#7F1D1D', alignItems: 'center',
  },
  modal_delete_text:{ color: Colors.white, fontWeight: FontWeight.bold },
  reason_btn:   {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  reason_btn_selected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  reason_icon:  { fontSize: IconSize.md },
  reason_label: { flex: 1, fontSize: FontSize.md, color: Colors.black },
  reason_label_selected:{ color: Colors.primary, fontWeight: FontWeight.bold },
  confirm_phrase:{
    fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.error,
    textAlign: 'center', letterSpacing: 1, padding: Spacing.md,
    backgroundColor: Colors.errorLight, borderRadius: Radius.sm,
  },
  confirm_input:{
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.md, fontSize: FontSize.md, textAlign: 'center',
    fontWeight: FontWeight.bold, letterSpacing: 1,
  },
  grace_note:   { fontSize: FontSize.xs, color: Colors.gray500, textAlign: 'center' },
})

const sectionStyles = StyleSheet.create({
  card:         {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  danger_card:  { borderColor: '#FCA5A5' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  icon:         { fontSize: IconSize.lg },
  title:        { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },
  danger_title: { color: Colors.error },
  desc:         { fontSize: FontSize.sm, color: Colors.gray600, lineHeight: 20 },
  body:         { gap: Spacing.sm },
})

const btnStyles = StyleSheet.create({
  btn:           { padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  secondary:     { borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  danger:        { backgroundColor: Colors.error },
  text:          { fontWeight: FontWeight.bold, fontSize: FontSize.md },
  secondary_text:{ color: Colors.primary },
  danger_text:   { color: Colors.white },
})

const linkStyles = StyleSheet.create({
  row:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  label: { fontSize: FontSize.md, color: Colors.black },
  arrow: { fontSize: IconSize.md, color: Colors.gray300 },
})
