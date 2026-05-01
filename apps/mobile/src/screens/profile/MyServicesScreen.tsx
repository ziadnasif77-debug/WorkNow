// ─────────────────────────────────────────────────────────────────────────────
// My Services Screen — provider views/manages their services AND job postings
// Sub-tabs: خدماتي (My Services) | وظائفي (My Jobs)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp, firebaseAuth } from '../../lib/firebase'
import { formatPrice } from '@workfix/utils'
import type { SupportedLocale } from '@workfix/types'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Badge, Card, EmptyState, SkeletonList, SegmentControl } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'
import MyJobsScreen from '../jobs/MyJobsScreen'

const functions        = getFunctions(firebaseApp, 'me-central1')
const getMyServicesFn  = httpsCallable(functions, 'marketplace-getMyServices')

interface Service {
  id: string
  name: { ar: string; en: string }
  description?: string
  basePrice: number
  currency: string
  isActive: boolean
}

type Tab = 'services' | 'jobs'

export default function MyServicesScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as SupportedLocale
  const _router  = useRouter()
  const uid      = firebaseAuth.currentUser?.uid

  const [activeTab, setActiveTab] = useState<Tab>('services')
  const [services,  setServices]  = useState<Service[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!uid || activeTab !== 'services') return
    setLoading(true)
    void getMyServicesFn({}).then(result => {
      const data = result.data as { services: Service[] }
      setServices(data.services)
    }).catch(() => {
      // non-critical — leave services empty
    }).finally(() => setLoading(false))
  }, [uid, activeTab])

  return (
    <View style={styles.container}>
      <ScreenHeader title={activeTab === 'services' ? t('jobs.myServices') : t('jobs.myJobs')} />

      <SegmentControl
        tabs={[
          { key: 'services', label: `🔧 ${t('jobs.myServices')}` },
          { key: 'jobs',     label: `💼 ${t('jobs.myJobs')}` },
        ]}
        activeKey={activeTab}
        onChange={key => setActiveTab(key as Tab)}
      />

      {/* Services tab */}
      {activeTab === 'services' && (
        loading ? (
          <SkeletonList count={5} />
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
              <EmptyState emoji="🔧" title={t('jobs.noServices')} subtitle={t('jobs.noServicesDesc')} />
            }
            renderItem={({ item }) => (
              <Card>
                <View style={styles.service_top}>
                  <Text style={styles.service_name}>{item.name[lang as 'ar' | 'en'] ?? item.name.ar}</Text>
                  <Badge
                    label={item.isActive ? t('jobs.active') : t('jobs.inactive')}
                    variant={item.isActive ? 'success' : 'neutral'}
                  />
                </View>
                {item.description && (
                  <Text style={styles.service_desc} numberOfLines={2}>{item.description}</Text>
                )}
                <Text style={styles.service_price}>
                  {formatPrice(item.basePrice, item.currency as never, lang)}+
                </Text>
              </Card>
            )}
          />
        )
      )}

      {/* Jobs tab */}
      {activeTab === 'jobs' && <MyJobsScreen />}
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  list:         { padding: Spacing.md, gap: Spacing.md },
  service_top:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  service_name:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  service_desc:  { fontSize: FontSize.sm, color: Colors.gray500 },
  service_price: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
})
