// ─────────────────────────────────────────────────────────────────────────────
// Admin Users Screen — search users, view details, ban/unban
// Shows recently registered users by default; supports search by name/phone/email
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native'
import type { Timestamp } from 'firebase/firestore'
import {
  getFirestore, collection, query, where,
  orderBy, limit, getDocs,
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

const ROLE_LABELS: Record<string, string> = {
  customer:   '👤 عميل',
  provider:   '🔧 مزوّد',
  admin:      '🛡️ مشرف',
  superadmin: '👑 مشرف عام',
}

export default function AdminUsersScreen() {
  const [searchQuery,  setSearchQuery]  = useState('')
  const [items,        setItems]        = useState<UserItem[]>([])
  const [recentItems,  setRecentItems]  = useState<UserItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [searching,    setSearching]    = useState(false)
  const [hasSearched,  setHasSearched]  = useState(false)
  const [selected,     setSelected]     = useState<UserItem | null>(null)
  const [banReason,    setBanReason]    = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [modalVisible, setModalVisible] = useState(false)

  // Load recently registered users on mount
  useEffect(() => {
    const db = getFirestore()
    const q  = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc'),
      limit(20),
    )
    getDocs(q)
      .then(snap => setRecentItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserItem))))
      .catch(e => { if (__DEV__) console.warn('[Users] recent error', e) })
      .finally(() => setLoading(false))
  }, [])

  const search = useCallback(async () => {
    const q = searchQuery.trim()
    if (q.length < 2) return
    setSearching(true)
    setHasSearched(true)
    try {
      const db   = getFirestore()
      const jobs: Promise<UserItem[]>[] = []

      // Search by displayName prefix
      jobs.push(
        getDocs(query(
          collection(db, 'users'),
          where('displayName', '>=', q),
          where('displayName', '<=', q + '\uf8ff'),
          orderBy('displayName'),
          limit(10),
        )).then(s => s.docs.map(d => ({ id: d.id, ...d.data() } as UserItem)))
      )

      // Search by phone (exact)
      if (/^[0-9+]/.test(q)) {
        jobs.push(
          getDocs(query(
            collection(db, 'users'),
            where('phone', '==', q),
            limit(5),
          )).then(s => s.docs.map(d => ({ id: d.id, ...d.data() } as UserItem)))
        )
      }

      // Search by email prefix
      if (q.includes('@') || q.includes('.')) {
        jobs.push(
          getDocs(query(
            collection(db, 'users'),
            where('email', '>=', q),
            where('email', '<=', q + '\uf8ff'),
            orderBy('email'),
            limit(5),
          )).then(s => s.docs.map(d => ({ id: d.id, ...d.data() } as UserItem)))
        )
      }

      const results = (await Promise.all(jobs)).flat()
      // Deduplicate by id
      const seen    = new Set<string>()
      setItems(results.filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true }))
    } catch (e) {
      if (__DEV__) console.warn('[Users] search error', e)
    } finally {
      setSearching(false)
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
      const updater = (prev: UserItem[]) =>
        prev.map(u => u.id === selected.id ? { ...u, isBanned: !u.isBanned } : u)
      setItems(updater)
      setRecentItems(updater)
      setModalVisible(false)
    } catch (e) {
      if (__DEV__) console.warn('[Users] ban error', e)
    } finally {
      setSubmitting(false)
    }
  }, [selected, banReason])

  const displayList  = hasSearched ? items : recentItems
  const listTitle    = hasSearched
    ? `نتائج البحث (${items.length})`
    : `أحدث المستخدمين (${recentItems.length})`

  return (
    <Screen scroll={false} padded={false}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث بالاسم أو الهاتف أو الإيميل..."
          value={searchQuery}
          onChangeText={t => { setSearchQuery(t); if (t.length === 0) setHasSearched(false) }}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={search}>
          <Text style={styles.searchBtnText}>بحث</Text>
        </TouchableOpacity>
      </View>

      {/* Section label */}
      <View style={styles.sectionBar}>
        <Text style={styles.sectionLabel}>{listTitle}</Text>
      </View>

      {loading || searching ? (
        <View style={styles.center}><ActivityIndicator color={Colors.error} size="large" /></View>
      ) : displayList.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyText}>
            {hasSearched ? 'لا توجد نتائج' : 'لا يوجد مستخدمون'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayList}
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
                  <Text style={styles.contact}>{item.email || item.phone || '—'}</Text>
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
            <Text style={styles.modalSub}>{selected?.email || selected?.phone || '—'}</Text>
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
  center:            { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchBar:         { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput:       { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, fontSize: FontSize.md },
  searchBtn:         { backgroundColor: Colors.error, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  searchBtnText:     { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  sectionBar:        { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.gray100 },
  sectionLabel:      { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray600 },
  list:              { padding: Spacing.md, gap: Spacing.sm },
  card:              { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  row:               { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar:            { width: 44, height: 44, borderRadius: Radius.full, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarBanned:      { backgroundColor: Colors.errorLight },
  avatarText:        { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  info:              { flex: 1 },
  nameRow:           { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  name:              { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  bannedBadge:       { backgroundColor: Colors.errorLight, paddingHorizontal: Spacing.xs, borderRadius: Radius.full },
  bannedText:        { fontSize: FontSize.xs, color: Colors.error, fontWeight: FontWeight.bold },
  contact:           { fontSize: FontSize.sm, color: Colors.gray500 },
  role:              { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  arrow:             { fontSize: FontSize.xl, color: Colors.gray400 },
  empty:             { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji:        { fontSize: IconSize.xxxl },
  emptyText:         { fontSize: FontSize.md, color: Colors.gray500, marginTop: Spacing.sm },
  overlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:             { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg },
  modalTitle:        { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  modalSub:          { fontSize: FontSize.sm, color: Colors.gray500, marginTop: 2 },
  modalRole:         { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold, marginTop: Spacing.xs, marginBottom: Spacing.md },
  bannedWarning:     { backgroundColor: Colors.errorLight, padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.md },
  bannedWarningText: { fontSize: FontSize.md, color: Colors.error, fontWeight: FontWeight.bold, textAlign: 'center' },
  label:             { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray700, marginBottom: Spacing.xs },
  reasonInput:       { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.md, marginBottom: Spacing.md, minHeight: 80 },
  modalActions:      { flexDirection: 'row', gap: Spacing.sm },
})
