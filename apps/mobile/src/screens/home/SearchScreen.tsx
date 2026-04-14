// ─────────────────────────────────────────────────────────────────────────────
// Search Screen — full provider search with filters
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Modal, ScrollView,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMarketplaceStore } from '../../stores/marketplaceStore'
import { Analytics } from '../../lib/analytics'
import { useLocation } from '../../hooks/useLocation'
import { ProviderCard, CategoryChip, EmptyState } from '../../components/marketplace'
import { Button, Chip, LoadingState } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize } from '../../constants/theme'

type SortBy = 'distance' | 'rating' | 'price'

export default function SearchScreen() {
  const { t }   = useTranslation()
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const params  = useLocalSearchParams<{ cat?: string; q?: string }>()
  const location = useLocation()
  const {
    categories, providers, searchLoading, hasMore,
    loadCategories, searchProviders, loadMore,
  } = useMarketplaceStore()

  const [query,        setQuery]        = useState(params.q ?? '')
  const [activeCatId,  setActiveCatId]  = useState<string | null>(params.cat ?? null)
  const [sortBy,       setSortBy]       = useState<SortBy>('distance')
  const [minRating,    setMinRating]    = useState<number | undefined>()
  const [radiusKm,     setRadiusKm]     = useState(20)
  const [showFilters,  setShowFilters]  = useState(false)

  useEffect(() => { void loadCategories() }, [])

  useEffect(() => {
    doSearch()
  }, [location.lat, location.lng, activeCatId, sortBy])

  function doSearch() {
    if (!location.lat || !location.lng) return
    if (query.trim()) void Analytics.providerSearch(query.trim(), activeCatId ?? undefined)
    void searchProviders({
      lat: location.lat, lng: location.lng,
      radiusKm, sortBy, minRating,
      categoryId: activeCatId ?? undefined,
      query:      query.trim() || undefined,
      limit: 20,
    })
  }

  function applyFilters() {
    setShowFilters(false)
    doSearch()
  }

  return (
    <View style={styles.container}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <View style={[styles.topbar, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back_btn}>
          <Text style={styles.back_icon}>←</Text>
        </TouchableOpacity>
        <View style={styles.search_wrap}>
          <TextInput
            style={styles.search_input}
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={Colors.gray400}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={doSearch}
            returnKeyType="search"
            autoFocus={!params.cat}
          />
        </View>
        <TouchableOpacity
          style={[styles.filter_btn, showFilters && styles.filter_btn_active]}
          onPress={() => setShowFilters(true)}
        >
          <Text style={styles.filter_icon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* ── Category chips ───────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cats_scroll}
        style={styles.cats_bar}
      >
        <CategoryChip
          label={t('common.all')}
          selected={activeCatId === null}
          onPress={() => setActiveCatId(null)}
        />
        {categories.map(cat => (
          <CategoryChip
            key={cat.id}
            label={cat.name.ar}
            selected={activeCatId === cat.id}
            onPress={() => setActiveCatId(cat.id)}
          />
        ))}
      </ScrollView>

      {/* ── Results count ─────────────────────────────────────────────────── */}
      {!searchLoading && providers.length > 0 && (
        <Text style={styles.results_count}>
          {providers.length} {t('search.results')}
          {activeCatId && ` · ${categories.find(c => c.id === activeCatId)?.name.ar ?? ''}`}
        </Text>
      )}

      {/* ── Results list ──────────────────────────────────────────────────── */}
      <FlatList
        data={providers}
        keyExtractor={p => p.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        contentContainerStyle={styles.list_content}
        showsVerticalScrollIndicator={false}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          searchLoading ? (
            <LoadingState />
          ) : (
            <EmptyState
              emoji="🔍"
              title={t('search.noResults')}
              subtitle={t('search.tryDifferentKeyword')}
              action={{ label: t('search.clearFilters'), onPress: () => { setQuery(''); setActiveCatId(null); doSearch() } }}
            />
          )
        }
        ListFooterComponent={
          hasMore ? <LoadingState style={{ marginTop: Spacing.lg }} /> : null
        }
        renderItem={({ item: p }) => (
          <ProviderCard
            id={p.id}
            displayName={p.displayName}
            avatarUrl={p.avatarUrl}
            type={p.type}
            avgRating={p.avgRating}
            totalReviews={p.totalReviews}
            distanceKm={p.distanceKm}
            isVerified={p.kycStatus === 'approved'}
            onPress={() => router.push({ pathname: '/provider/[id]', params: { id: p.id } })}
            horizontal
            style={styles.provider_item}
          />
        )}
      />

      {/* ── Filters modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modal_overlay}>
          <View style={styles.modal_sheet}>
            <View style={styles.modal_handle} />
            <Text style={styles.modal_title}>{t('search.filters')}</Text>

            {/* Sort by */}
            <Text style={styles.filter_label}>{t('search.sortBy')}</Text>
            <View style={styles.filter_row}>
              {(['distance', 'rating', 'price'] as SortBy[]).map(s => (
                <Chip key={s} label={t(`search.sort_${s}`)} selected={sortBy === s} onPress={() => setSortBy(s)} />
              ))}
            </View>

            {/* Min rating */}
            <Text style={styles.filter_label}>{t('search.minRating')}</Text>
            <View style={styles.filter_row}>
              {[undefined, 3, 4, 4.5].map(r => (
                <Chip key={String(r)} label={r == null ? t('common.all') : `${r}★+`} selected={minRating === r} onPress={() => setMinRating(r)} />
              ))}
            </View>

            {/* Radius */}
            <Text style={styles.filter_label}>{t('search.radius')}: {radiusKm} {t('common.km')}</Text>
            <View style={styles.filter_row}>
              {[5, 10, 20, 50].map(r => (
                <Chip key={r} label={`${r} ${t('common.km')}`} selected={radiusKm === r} onPress={() => setRadiusKm(r)} />
              ))}
            </View>

            <View style={styles.filter_actions}>
              <Button label={t('search.applyFilters')} onPress={applyFilters} />
              <Button
                label={t('search.resetFilters')}
                variant="ghost"
                onPress={() => { setSortBy('distance'); setMinRating(undefined); setRadiusKm(20) }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.background },

  topbar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  back_btn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  back_icon: { fontSize: IconSize.md, color: Colors.primary },
  search_wrap: {
    flex: 1, height: 42,
    backgroundColor: Colors.gray100, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, justifyContent: 'center',
  },
  search_input: { fontSize: FontSize.md, color: Colors.black },
  filter_btn: {
    width: 42, height: 42, borderRadius: Radius.md,
    backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center',
  },
  filter_btn_active: { backgroundColor: Colors.primaryLight },
  filter_icon:       { fontSize: IconSize.md },

  cats_bar:    { maxHeight: 52, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cats_scroll: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },

  results_count: {
    fontSize: FontSize.sm, color: Colors.gray500,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },

  list_content:   { padding: Spacing.md, gap: Spacing.md },
  provider_item:  {},

  // Filter modal
  modal_overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal_sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md,
  },
  modal_handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.gray200, alignSelf: 'center', marginBottom: Spacing.sm,
  },
  modal_title:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  filter_label:   { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.gray700 },
  filter_row:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  filter_actions: { gap: Spacing.sm, marginTop: Spacing.sm } })
