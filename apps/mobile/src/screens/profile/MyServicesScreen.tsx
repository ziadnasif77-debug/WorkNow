// ─────────────────────────────────────────────────────────────────────────────
// My Services Screen — provider views/manages their services
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { firestore, firebaseAuth } from '../../lib/firebase'
import { formatPrice } from '@workfix/utils'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'
import { EmptyState } from '../../components/marketplace'

interface Service {
  id: string
  name: { ar: string; en: string }
  description?: string
  basePrice: number
  currency: string
  isActive: boolean
}

export default function MyServicesScreen() {
  const { t }  = useTranslation()
  const router = useRouter()
  const uid    = firebaseAuth.currentUser?.uid

  const [services, setServices] = useState<Service[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!uid) return
    void getDocs(
      query(collection(firestore, 'services'), where('providerId', '==', uid)),
    ).then(snap => {
      setServices(snap.docs.map(d => ({ ...d.data(), id: d.id } as Service)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [uid])

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('profile.myServices')} />

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : (
        <FlatList
          data={services}
          keyExtractor={s => s.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              emoji="🔧"
              title="لا خدمات بعد"
              subtitle="أضف خدماتك لتظهر للعملاء"
            />
          }
          renderItem={({ item }) => (
            <View style={styles.service_card}>
              <View style={styles.service_top}>
                <Text style={styles.service_name}>{item.name.ar}</Text>
                <View style={[styles.active_badge,
                  !item.isActive && styles.inactive_badge]}>
                  <Text style={[styles.active_text,
                    !item.isActive && styles.inactive_text]}>
                    {item.isActive ? 'نشط' : 'متوقف'}
                  </Text>
                </View>
              </View>
              {item.description && (
                <Text style={styles.service_desc} numberOfLines={2}>{item.description}</Text>
              )}
              <Text style={styles.service_price}>
                {formatPrice(item.basePrice, item.currency as never, 'ar')}+
              </Text>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  list:  { padding: Spacing.md, gap: Spacing.md },
  service_card: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  service_top:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  service_name: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  service_desc: { fontSize: FontSize.sm, color: Colors.gray500 },
  service_price: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  active_badge: {
    backgroundColor: Colors.successLight, borderRadius: 99,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  inactive_badge: { backgroundColor: Colors.gray100 },
  active_text:    { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.bold },
  inactive_text:  { color: Colors.gray400 },
})
