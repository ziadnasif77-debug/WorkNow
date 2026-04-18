// ─────────────────────────────────────────────────────────────────────────────
// Admin KYC Screen — review pending provider verifications
// Documents are stored in kycSubmissions/{providerId} (Phase 7 security hardening)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native'
import type { Timestamp } from 'firebase/firestore'
import {
  getFirestore, collection, query, where,
  orderBy, onSnapshot, getDoc, doc,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { Screen, Button } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow, IconSize } from '../../constants/theme'

interface KycItem {
  id:           string
  displayName:  string
  email:        string
  kycDocuments: string[]   // document URLs from kycSubmissions collection
  kycStatus:    string
  createdAt:    Timestamp
}

type Decision = 'approved' | 'rejected' | 'resubmit'

export default function AdminKycScreen() {
  const [items,      setItems]      = useState<KycItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<KycItem | null>(null)
  const [decision,   setDecision]   = useState<Decision>('approved')
  const [note,       setNote]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    const db = getFirestore()
    const q  = query(
      collection(db, 'providerProfiles'),
      where('kycStatus', '==', 'pending'),
      orderBy('createdAt', 'asc'),
    )

    const unsub = onSnapshot(q, async snap => {
      const profiles = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Omit<KycItem, 'kycDocuments'>[]

      // Fetch document URLs from kycSubmissions for each provider
      const withDocs = await Promise.all(
        profiles.map(async profile => {
          try {
            const subSnap = await getDoc(doc(db, 'kycSubmissions', profile.id))
            const docs: string[] = subSnap.exists()
              ? (subSnap.data()['documentUrls'] ?? subSnap.data()['kycDocuments'] ?? [])
              : []
            return { ...profile, kycDocuments: docs } as KycItem
          } catch {
            return { ...profile, kycDocuments: [] } as KycItem
          }
        })
      )

      setItems(withDocs)
      setLoading(false)
    })

    return unsub
  }, [])

  const openModal = useCallback((item: KycItem) => {
    setSelected(item)
    setDecision('approved')
    setNote('')
    setModalVisible(true)
  }, [])

  const submit = useCallback(async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const fn = httpsCallable(getFunctions(undefined, 'me-central1'), 'admin-approveKyc')
      await fn({ providerId: selected.id, decision, note: note.trim() || undefined })
      setModalVisible(false)
    } catch (e) {
      if (__DEV__) console.warn('[KYC] submit error', e)
    } finally {
      setSubmitting(false)
    }
  }, [selected, decision, note])

  if (loading) {
    return <Screen><View style={styles.center}><ActivityIndicator color={Colors.error} size="large" /></View></Screen>
  }

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>طلبات KYC ({items.length})</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>✅</Text>
          <Text style={styles.emptyText}>لا توجد طلبات معلّقة</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openModal(item)}>
              <View style={styles.cardRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.displayName?.[0] ?? '?'}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.displayName}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                  <Text style={styles.docsCount}>📎 {item.kycDocuments?.length ?? 0} مستند</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </View>

              {/* Document previews */}
              {(item.kycDocuments ?? []).length > 0 && (
                <View style={styles.docs}>
                  {item.kycDocuments.slice(0, 3).map((url, i) => (
                    <Image key={i} source={{ uri: url }} style={styles.docThumb} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Decision Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modal}>
            <Text style={styles.modalTitle}>مراجعة KYC</Text>
            <Text style={styles.modalSub}>{selected?.displayName}</Text>
            <Text style={styles.modalEmail}>{selected?.email}</Text>

            {/* Full documents */}
            {(selected?.kycDocuments ?? []).length === 0 ? (
              <View style={styles.noDocs}>
                <Text style={styles.noDocsText}>لا توجد مستندات مرفقة</Text>
              </View>
            ) : (
              (selected?.kycDocuments ?? []).map((url, i) => (
                <Image key={i} source={{ uri: url }} style={styles.docFull} resizeMode="contain" />
              ))
            )}

            {/* Decision buttons */}
            <Text style={styles.label}>القرار</Text>
            <View style={styles.decisionRow}>
              {(['approved', 'rejected', 'resubmit'] as Decision[]).map(d => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.decBtn,
                    decision === d && d === 'approved' && styles.decBtnApproved,
                    decision === d && d === 'rejected' && styles.decBtnRejected,
                    decision === d && d === 'resubmit' && styles.decBtnResubmit,
                  ]}
                  onPress={() => setDecision(d)}
                >
                  <Text style={[styles.decText, decision === d && styles.decTextActive]}>
                    {d === 'approved' ? '✅ قبول' : d === 'rejected' ? '❌ رفض' : '🔄 إعادة'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>ملاحظة (اختياري)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="سبب القرار..."
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <Button label="إلغاء" variant="outline" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
              <Button
                label="تأكيد"
                variant={decision === 'approved' ? 'primary' : 'danger'}
                onPress={submit}
                isLoading={submitting}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBar:      { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white },
  title:          { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  list:           { padding: Spacing.md, gap: Spacing.sm },
  card:           { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  cardRow:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar:         { width: 44, height: 44, borderRadius: Radius.full, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  info:           { flex: 1 },
  name:           { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  email:          { fontSize: FontSize.sm, color: Colors.gray500 },
  docsCount:      { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  arrow:          { fontSize: FontSize.xl, color: Colors.gray400 },
  docs:           { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  docThumb:       { width: 60, height: 60, borderRadius: Radius.md, backgroundColor: Colors.gray100 },
  empty:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji:     { fontSize: IconSize.xxxl },
  emptyText:      { fontSize: FontSize.md, color: Colors.gray500, marginTop: Spacing.sm },
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll:    { maxHeight: '92%' },
  modal:          { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  modalTitle:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  modalSub:       { fontSize: FontSize.md, color: Colors.gray700, marginTop: 2 },
  modalEmail:     { fontSize: FontSize.sm, color: Colors.gray500, marginBottom: Spacing.md },
  noDocs:         { backgroundColor: Colors.gray100, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginBottom: Spacing.md },
  noDocsText:     { fontSize: FontSize.sm, color: Colors.gray500 },
  docFull:        { width: '100%', height: 180, borderRadius: Radius.md, backgroundColor: Colors.gray100, marginBottom: Spacing.sm },
  label:          { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray700, marginBottom: Spacing.xs },
  decisionRow:    { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  decBtn:         { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  decBtnApproved: { backgroundColor: Colors.successLight, borderColor: Colors.success },
  decBtnRejected: { backgroundColor: Colors.errorLight,   borderColor: Colors.error },
  decBtnResubmit: { backgroundColor: Colors.warningLight, borderColor: Colors.warning },
  decText:        { fontSize: FontSize.sm, color: Colors.gray600 },
  decTextActive:  { fontWeight: FontWeight.bold, color: Colors.black },
  noteInput:      { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.md, marginBottom: Spacing.md, minHeight: 70 },
  modalActions:   { flexDirection: 'row', gap: Spacing.sm },
})
