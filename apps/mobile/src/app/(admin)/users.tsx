// ─────────────────────────────────────────────────────────────────────────────
// Admin Users Screen — search users, view details, ban/unban
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native'
import type { Timestamp} from 'firebase/firestore';
import {
  getFirestore, collection, query, where,
  orderBy, limit, getDocs
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { Screen, Button } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow, IconSize } from '../../constants/theme'

interface UserItem {
  id:          string
  displayName: string
  email:       string
  phone:       string
  role:        string
  isBanned:    boolean
  createdAt:   Timestamp
}

export default function AdminUsersScreen() {
  const [searchQuery, setSearchQuery] = useState('')
  const [items,     setItems]     = useState<UserItem[]>([])
  const [loading,   setLoading]   = useState(false)
  const [selected,  setSelected]  = useState<UserItem | null>(null)
  const [banReason, setBanReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)

  const search = useCallback(async () => {
    if (searchQuery.trim().length < 2) return
    setLoading(true)
    try {
      const db = getFirestore()
      // Search by displayName prefix
      const q = query(
        collection(db, 'users'),
        where('displayName', '>=', searchQuery),
        where('displayName', '<=', searchQuery + '\uf8ff'),
        orderBy('displayName'),
        limit(20),
      )
      const snap = await getDocs(q)
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserItem)))
    } catch (e) {
      if (__DEV__) console.warn('[Users] search error', e)
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  const openModal = useCallback((item: UserItem) => {
    setSelected(item)
    setBanReason('')
    setModalVisible(true)
  }, [])

  const toggleBan = useCallback(async () => {
    if (!selected) return
    if (!selected.isBanned && banReason.trim().length < 5) {
      Alert.alert('خطأ', 'يرجى كتابة سبب الحظر (5 أحرف على الأقل)')
      return
    }
    setSubmitting(true)
    try {
      const fn = httpsCallable(getFunctions(undefined, 'me-central1'), 'admin-banUser')
      await fn({
        targetUid: selected.id,
        ban:       !selected.isBanned,
        reason:    banReason.trim() || 'إلغاء الحظر',
      })
      setItems(prev => prev.map(u => u.id === selected.id ? { ...u, isBanned: !u.isBanned } : u))
      setModalVisible(false)
    } catch (e) {
      if (__DEV__) console.warn('[Users] ban error', e)
    } finally {
      setSubmitting(false)
    }
  }, [selected, banReason])

  const ROLE_LABELS: Record<string, string> = {
    customer:    '👤 عميل',
    provider:    '🔧 مزوّد',
    admin:       '🛡️ مشرف',
    superadmin:  '👑 مشرف عام',
  }

  return (
    <Screen scroll={false} padded={false}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث باسم المستخدم..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={search}>
          <Text style={styles.searchBtnText}>بحث</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.error} size="large" /></View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyText}>ابحث عن مستخدم</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openModal(item)}>
              <View style={styles.row}>
                <View style={[styles.avatar, item.isBanned && styles.avatarBanned]}>
                  <Text style={styles.avatarText}>{item.displayName?.[0] ?? '?'}</Text>
                </View>
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{item.displayName}</Text>
                    {item.isBanned && (
                      <View style={styles.bannedBadge}>
                        <Text style={styles.bannedText}>محظور</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.email}>{item.email || item.phone}</Text>
                  <Text style={styles.role}>{ROLE_LABELS[item.role] ?? item.role}</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* User action Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{selected?.displayName}</Text>
            <Text style={styles.modalSub}>{selected?.email || selected?.phone}</Text>
            <Text style={styles.modalRole}>{ROLE_LABELS[selected?.role ?? ''] ?? selected?.role}</Text>

            {selected?.isBanned ? (
              <>
                <View style={styles.bannedWarning}>
                  <Text style={styles.bannedWarningText}>⛔ هذا المستخدم محظور حالياً</Text>
                </View>
                <View style={styles.modalActions}>
                  <Button label="إلغاء" variant="outline" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
                  <Button label="رفع الحظر" variant="primary" onPress={toggleBan} isLoading={submitting} style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>سبب الحظر</Text>
                <TextInput
                  style={styles.reasonInput}
                  placeholder="اكتب سبب الحظر..."
                  value={banReason}
                  onChangeText={setBanReason}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.modalActions}>
                  <Button label="إلغاء" variant="outline" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
                  <Button label="حظر المستخدم" variant="danger" onPress={toggleBan} isLoading={submitting} style={{ flex: 1 }} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchBar:       { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput:     { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, fontSize: FontSize.md },
  searchBtn:       { backgroundColor: Colors.error, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  searchBtnText:   { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  list:            { padding: Spacing.md, gap: Spacing.sm },
  card:            { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  row:             { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar:          { width: 44, height: 44, borderRadius: Radius.full, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarBanned:    { backgroundColor: Colors.errorLight },
  avatarText:      { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  info:            { flex: 1 },
  nameRow:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  name:            { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  bannedBadge:     { backgroundColor: Colors.errorLight, paddingHorizontal: Spacing.xs, borderRadius: Radius.full },
  bannedText:      { fontSize: FontSize.xs, color: Colors.error, fontWeight: FontWeight.bold },
  email:           { fontSize: FontSize.sm, color: Colors.gray500 },
  role:            { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  arrow:           { fontSize: FontSize.xl, color: Colors.gray400 },
  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji:      { fontSize: IconSize.xxxl },
  emptyText:       { fontSize: FontSize.md, color: Colors.gray500, marginTop: Spacing.sm },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:           { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg },
  modalTitle:      { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  modalSub:        { fontSize: FontSize.sm, color: Colors.gray500, marginTop: 2 },
  modalRole:       { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold, marginTop: Spacing.xs, marginBottom: Spacing.md },
  bannedWarning:   { backgroundColor: Colors.errorLight, padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.md },
  bannedWarningText: { fontSize: FontSize.md, color: Colors.error, fontWeight: FontWeight.bold, textAlign: 'center' },
  label:           { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray700, marginBottom: Spacing.xs },
  reasonInput:     { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.md, marginBottom: Spacing.md, minHeight: 80 },
  modalActions:    { flexDirection: 'row', gap: Spacing.sm },
})
