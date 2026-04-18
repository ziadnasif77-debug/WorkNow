// ─────────────────────────────────────────────────────────────────────────────
// Admin Disputes Screen — resolve open disputes
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, TextInput, Modal,
} from 'react-native'
import type { Timestamp } from 'firebase/firestore'
import {
  getFirestore, collection, query, where,
  orderBy, onSnapshot, getDoc, doc,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { Screen, Button } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow, IconSize } from '../../constants/theme'

interface DisputeItem {
  id:             string
  orderId:        string
  customerId:     string
  providerId:     string
  customerName:   string
  providerName:   string
  reason:         string
  description:    string
  status:         'open' | 'under_review' | 'resolved'
  amount?:        number
  currency?:      string
  createdAt:      Timestamp
}

type ReleaseParty = 'customer' | 'provider'

const REASON_LABELS: Record<string, string> = {
  not_completed: 'العمل لم يكتمل',
  poor_quality:  'جودة رديئة',
  no_show:       'لم يحضر',
  overcharged:   'سعر زائد',
  damage:        'ضرر',
  other:         'أخرى',
}

export default function AdminDisputesScreen() {
  const [items,      setItems]      = useState<DisputeItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<DisputeItem | null>(null)
  const [party,      setParty]      = useState<ReleaseParty>('customer')
  const [resolution, setResolution] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    const db = getFirestore()
    const q  = query(
      collection(db, 'disputes'),
      where('status', 'in', ['open', 'under_review']),
      orderBy('createdAt', 'asc'),
    )

    const unsub = onSnapshot(q, async snap => {
      const base = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Omit<DisputeItem, 'customerName' | 'providerName'>[]

      // Collect unique user IDs to batch fetch
      const userIds = new Set<string>()
      base.forEach(d => { userIds.add(d.customerId); userIds.add(d.providerId) })

      const nameMap: Record<string, string> = {}
      await Promise.all(
        Array.from(userIds).map(async uid => {
          try {
            const snap = await getDoc(doc(db, 'users', uid))
            nameMap[uid] = snap.exists() ? (snap.data()['displayName'] ?? uid.slice(-6)) : uid.slice(-6)
          } catch {
            nameMap[uid] = uid.slice(-6)
          }
        })
      )

      setItems(base.map(d => ({
        ...d,
        customerName: nameMap[d.customerId] ?? d.customerId.slice(-6),
        providerName: nameMap[d.providerId] ?? d.providerId.slice(-6),
      })))
      setLoading(false)
    })

    return unsub
  }, [])

  const openModal = useCallback((item: DisputeItem) => {
    setSelected(item)
    setParty('customer')
    setResolution('')
    setModalVisible(true)
  }, [])

  const submit = useCallback(async () => {
    if (!selected || resolution.trim().length < 10) return
    setSubmitting(true)
    try {
      const fn = httpsCallable(getFunctions(undefined, 'me-central1'), 'admin-resolveDispute')
      await fn({ disputeId: selected.id, resolution: resolution.trim(), releaseToParty: party })
      setModalVisible(false)
    } catch (e) {
      if (__DEV__) console.warn('[Disputes] submit error', e)
    } finally {
      setSubmitting(false)
    }
  }, [selected, party, resolution])

  if (loading) {
    return <Screen><View style={styles.center}><ActivityIndicator color={Colors.error} size="large" /></View></Screen>
  }

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>النزاعات المفتوحة ({items.length})</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>⚖️</Text>
          <Text style={styles.emptyText}>لا توجد نزاعات مفتوحة</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openModal(item)}>
              <View style={styles.cardHeader}>
                <View style={[styles.badge, item.status === 'under_review' && styles.badgeReview]}>
                  <Text style={styles.badgeText}>
                    {item.status === 'under_review' ? 'قيد المراجعة' : 'مفتوح'}
                  </Text>
                </View>
                <Text style={styles.date}>
                  {item.createdAt?.toDate().toLocaleDateString('ar-SA') ?? '—'}
                </Text>
              </View>
              <Text style={styles.reason}>
                📌 {REASON_LABELS[item.reason] ?? item.reason}
              </Text>
              <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
              <View style={styles.partiesRow}>
                <Text style={styles.party}>👤 {item.customerName}</Text>
                <Text style={styles.partySep}>vs</Text>
                <Text style={styles.party}>🔧 {item.providerName}</Text>
              </View>
              <Text style={styles.orderId}>طلب #{item.orderId.slice(-8)}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Resolution Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>حل النزاع</Text>
            <Text style={styles.modalSub}>
              📌 {selected ? (REASON_LABELS[selected.reason] ?? selected.reason) : ''}
            </Text>
            <Text style={styles.modalDesc}>{selected?.description}</Text>

            {/* Parties info */}
            <View style={styles.partiesCard}>
              <View style={styles.partyInfo}>
                <Text style={styles.partyInfoLabel}>العميل</Text>
                <Text style={styles.partyInfoName}>{selected?.customerName}</Text>
              </View>
              <Text style={styles.vsText}>⚖️</Text>
              <View style={[styles.partyInfo, { alignItems: 'flex-end' }]}>
                <Text style={styles.partyInfoLabel}>المزوّد</Text>
                <Text style={styles.partyInfoName}>{selected?.providerName}</Text>
              </View>
            </View>

            {selected?.amount != null && (
              <Text style={styles.amountText}>
                💰 مبلغ النزاع: {selected.amount.toLocaleString('ar-SA')} {selected.currency ?? 'SAR'}
              </Text>
            )}

            <Text style={styles.label}>تحرير المبلغ لصالح</Text>
            <View style={styles.partyRow}>
              {(['customer', 'provider'] as ReleaseParty[]).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.partyBtn, party === p && styles.partyBtnActive]}
                  onPress={() => setParty(p)}
                >
                  <Text style={[styles.partyText, party === p && styles.partyTextActive]}>
                    {p === 'customer'
                      ? `👤 ${selected?.customerName ?? 'العميل'}`
                      : `🔧 ${selected?.providerName ?? 'المزوّد'}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>قرار التسوية (10 أحرف على الأقل)</Text>
            <TextInput
              style={styles.resInput}
              placeholder="اكتب قرار التسوية التفصيلي..."
              value={resolution}
              onChangeText={setResolution}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <Button label="إلغاء" variant="outline" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
              <Button
                label="تأكيد الحل"
                variant="primary"
                onPress={submit}
                isLoading={submitting}
                disabled={resolution.trim().length < 10}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBar:       { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white },
  title:           { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  list:            { padding: Spacing.md, gap: Spacing.sm },
  card:            { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  badge:           { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: Colors.errorLight },
  badgeReview:     { backgroundColor: Colors.warningLight },
  badgeText:       { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.error },
  date:            { fontSize: FontSize.xs, color: Colors.gray400 },
  reason:          { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: Spacing.xs },
  desc:            { fontSize: FontSize.sm, color: Colors.gray600, marginBottom: Spacing.xs },
  partiesRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  party:           { fontSize: FontSize.xs, color: Colors.gray600 },
  partySep:        { fontSize: FontSize.xs, color: Colors.gray400 },
  orderId:         { fontSize: FontSize.xs, color: Colors.gray400 },
  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji:      { fontSize: IconSize.xxxl },
  emptyText:       { fontSize: FontSize.md, color: Colors.gray500, marginTop: Spacing.sm },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:           { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg },
  modalTitle:      { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  modalSub:        { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray700, marginTop: Spacing.xs },
  modalDesc:       { fontSize: FontSize.sm, color: Colors.gray500, marginTop: Spacing.xs, marginBottom: Spacing.sm },
  partiesCard:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.gray50, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  partyInfo:       { flex: 1 },
  partyInfoLabel:  { fontSize: FontSize.xs, color: Colors.gray400 },
  partyInfoName:   { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.black },
  vsText:          { fontSize: FontSize.lg, color: Colors.gray400 },
  amountText:      { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  label:           { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray700, marginBottom: Spacing.xs },
  partyRow:        { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  partyBtn:        { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  partyBtnActive:  { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  partyText:       { fontSize: FontSize.sm, color: Colors.gray600 },
  partyTextActive: { fontWeight: FontWeight.bold, color: Colors.primary },
  resInput:        { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.md, marginBottom: Spacing.md, minHeight: 90 },
  modalActions:    { flexDirection: 'row', gap: Spacing.sm },
})
