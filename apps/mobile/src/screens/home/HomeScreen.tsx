// ─────────────────────────────────────────────────────────────────────────────
// Home Screen — main discovery page
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  TextInput, TouchableOpacity, ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import { useMarketplaceStore } from '../../stores/marketplaceStore'
import { useLocation } from '../../hooks/useLocation'
import { ProviderCard, CategoryChip, EmptyState } from '../../components/marketplace'
import { Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize, AvatarSize } from '../../constants/theme'

import { useNotificationsStore } from '../../stores/notificationsStore'

export default function HomeScreen() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const { firebaseUser } = useAuthStore()
  const {
    categories, categoriesLoading,
    providers,  searchLoading,
    loadCategories, searchProviders, clearSearch,
  } = useMarketplaceStore()

  const location   = useLocation()
  const { unreadCount } = useNotificationsStore()

  const [searchText,   setSearchText]   = useState('')
  const [activeCatId,  setActiveCatId]  = useState<string | null>(null)
  const [refreshing,   setRefreshing]   = useState(false)

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    void loadCategories()
  }, [])

  useEffect(() => {
    if (location.lat && location.lng) {
      void searchProviders({
        lat:       location.lat,
        lng:       location.lng,
        radiusKm:  20,
        limit:     10,
        sortBy:    'distance',
      })
    }
  }, [location.lat, location.lng])

  // ── Pull to refresh ─────────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    if (location.lat && location.lng) {
      await searchProviders({
        lat: location.lat, lng: location.lng,
        radiusKm: 20, limit: 10, sortBy: 'distance',
        categoryId: activeCatId ?? undefined,
        query: searchText || undefined,
      })
    }
    setRefreshing(false)
  }, [location.lat, location.lng, activeCatId, searchText])

  // ── Category filter ─────────────────────────────────────────────────────────
  function onCategoryPress(catId: string) {
    const next = activeCatId === catId ? null : catId
    setActiveCatId(next)
    if (location.lat && location.lng) {
      void searchProviders({
        lat: location.lat, lng: location.lng,
        radiusKm: 20, limit: 20, sortBy: 'distance',
        categoryId: next ?? undefined,
        query: searchText || undefined,
      })
    }
  }

  // ── Search submit ───────────────────────────────────────────────────────────
  function onSearchSubmit() {
    if (location.lat && location.lng) {
      void searchProviders({
        lat: location.lat, lng: location.lng,
        radiusKm: 20, limit: 20, sortBy: 'distance',
        query: searchText || undefined,
        categoryId: activeCatId ?? undefined,
      })
    }
  }

  const displayName = (firebaseUser?.displayName ?? '').split(' ')[0] ?? ''

  return (
    <Screen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        stickyHeaderIndices={[1]}  // sticky search bar
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {t('home.greeting', { name: displayName || t('common.there') })}
            </Text>
            <View style={styles.location_row}>
              <Text style={styles.location_icon}>📍</Text>
              <Text style={styles.location_text}>
                {location.isLoading ? '...' : location.city}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notification_btn}
            onPress={() => router.push('/notifications')}
          >
            <Text style={styles.notification_icon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.notif_badge}>
                <Text style={styles.notif_badge_text}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Search bar (sticky) ─────────────────────────────────────────── */}
        <View style={styles.search_container}>
          <View style={styles.search_box}>
            <Text style={styles.search_icon}>🔍</Text>
            <TextInput
              style={styles.search_input}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor={Colors.gray400}
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={onSearchSubmit}
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchText(''); clearSearch(); onRefresh() }}>
                <Text style={styles.search_clear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Categories ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.section_header}>
            <Text style={styles.section_title}>{t('home.categories')}</Text>
            <TouchableOpacity onPress={() => router.push('/categories')}>
              <Text style={styles.see_all}>{t('home.seeAll')}</Text>
            </TouchableOpacity>
          </View>

          {categoriesLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.md }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats_scroll}>
              <CategoryChip
                label={t('common.all')}
                selected={activeCatId === null}
                onPress={() => onCategoryPress(activeCatId ?? '')}
              />
              {categories.map(cat => (
                <CategoryChip
                  key={cat.id}
                  label={cat.name.ar}
                  selected={activeCatId === cat.id}
                  onPress={() => onCategoryPress(cat.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Nearby Providers ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.section_header}>
            <Text style={styles.section_title}>{t('home.nearbyProviders')}</Text>
            <TouchableOpacity onPress={() => router.push('/search')}>
              <Text style={styles.see_all}>{t('home.seeAll')}</Text>
            </TouchableOpacity>
          </View>

          {searchLoading && providers.length === 0 ? (
            <View style={styles.loading_row}>
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </View>
          ) : providers.length === 0 ? (
            <EmptyState
              emoji="🔍"
              title={t('home.noProvidersNearby')}
              subtitle={t('home.tryExpandingRadius')}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.providers_scroll}
            >
              {providers.map(p => (
                <ProviderCard
                  key={p.id}
                  id={p.id}
                  displayName={p.displayName}
                  avatarUrl={p.avatarUrl}
                  type={p.type}
                  avgRating={p.avgRating}
                  totalReviews={p.totalReviews}
                  distanceKm={p.distanceKm}
                  isVerified={p.kycStatus === 'approved'}
                  onPress={() => router.push({ pathname: '/provider/[id]', params: { id: p.id } })}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Quick Actions ───────────────────────────────────────────────── */}
        <View style={[styles.section, { paddingHorizontal: Spacing.lg }]}>
          <Text style={styles.section_title}>{t('home.quickActions')}</Text>
          <View style={styles.quick_grid}>
            {QUICK_ACTIONS.map(a => (
              <TouchableOpacity
                key={a.key}
                style={styles.quick_card}
                onPress={() => router.push(a.route as never)}
                activeOpacity={0.8}
              >
                <Text style={styles.quick_emoji}>{a.emoji}</Text>
                <Text style={styles.quick_label}>{t(a.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </Screen>
  )
}

const QUICK_ACTIONS = [
  { key: 'plumbing',    emoji: '🚿', labelKey: 'categories.plumbing',  route: '/search?cat=plumbing' },
  { key: 'electrical',  emoji: '⚡', labelKey: 'categories.electrical', route: '/search?cat=electrical' },
  { key: 'cleaning',    emoji: '🧹', labelKey: 'categories.cleaning',   route: '/search?cat=cleaning' },
  { key: 'ac',          emoji: '❄️', labelKey: 'categories.ac',         route: '/search?cat=ac' },
]

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.avatar} />
      <View style={skeletonStyles.line_long} />
      <View style={skeletonStyles.line_short} />
    </View>
  )
}

const skeletonStyles = StyleSheet.create({
  card:       { width: 150, height: 160, borderRadius: Radius.lg, backgroundColor: Colors.gray100, padding: Spacing.md, gap: Spacing.sm, alignItems: 'center' },
  avatar:     { width: AvatarSize.xl, height: AvatarSize.xl, borderRadius: Radius.full, backgroundColor: Colors.gray200 },
  line_long:  { width: 100, height: 12, borderRadius: Radius.sm, backgroundColor: Colors.gray200 },
  line_short: { width: 70, height: 10, borderRadius: Radius.sm, backgroundColor: Colors.gray200 },
})

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
  },
  greeting:          { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  location_row:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  location_icon:     { fontSize: IconSize.sm },
  location_text:     { fontSize: FontSize.sm, color: Colors.gray500 },
  notification_btn:  { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notification_icon: { fontSize: IconSize.md },
  notif_badge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: Radius.full,
    backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: Colors.background,
  },
  notif_badge_text: { color: Colors.white, fontSize: IconSize.xs, fontWeight: FontWeight.bold },

  search_container: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.background },
  search_box: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 48,
  },
  search_icon:  { fontSize: IconSize.sm },
  search_input: { flex: 1, fontSize: FontSize.md, color: Colors.black },
  search_clear: { fontSize: IconSize.sm, color: Colors.gray400, padding: 4 },

  section:        { marginTop: Spacing.lg },
  section_header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  section_title:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },
  see_all:        { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },

  cats_scroll:      { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  providers_scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  loading_row:      { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.lg },

  quick_grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm },
  quick_card: {
    flex: 1, minWidth: '45%',
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  quick_emoji: { fontSize: IconSize.xl },
  quick_label: { fontSize: FontSize.sm, color: Colors.gray700, fontWeight: FontWeight.medium, textAlign: 'center' },
})
