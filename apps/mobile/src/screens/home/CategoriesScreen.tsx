// ─────────────────────────────────────────────────────────────────────────────
// Categories Screen — full grid of all service categories
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMarketplaceStore } from '../../stores/marketplaceStore'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Card, EmptyState, LoadingState } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize } from '../../constants/theme'

export default function CategoriesScreen() {
  const { t, i18n } = useTranslation()
  const router       = useRouter()
  const lang         = (i18n.language === 'ar' ? 'ar' : 'en') as 'ar' | 'en'
  const { categories, categoriesLoading, loadCategories } = useMarketplaceStore()

  useEffect(() => { void loadCategories() }, [])

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('home.categories')} />

      {categoriesLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={c => c.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={
            <EmptyState
              emoji="📂"
              title={t('home.categories')}
              subtitle={t('home.noProvidersNearby')}
            />
          }
          renderItem={({ item }) => (
            <Card
              onPress={() => router.push(`/search?cat=${item.id}`)}
              padding={Spacing.lg}
              gap={Spacing.sm}
              style={{ flex: 1, alignItems: 'center', borderRadius: Radius.xl, minHeight: 120 }}
            >
              <Text style={styles.cat_icon}>{item.icon ?? '🔧'}</Text>
              <Text style={styles.cat_name}>{item.name[lang]}</Text>
              {item.serviceCount != null && (
                <Text style={styles.cat_count}>{item.serviceCount} خدمة</Text>
              )}
            </Card>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  grid:  { padding: Spacing.md, gap: Spacing.md },
  row:   { gap: Spacing.md },
  cat_icon:  { fontSize: IconSize.xl },
  cat_name:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black, textAlign: 'center' },
  cat_count: { fontSize: FontSize.xs, color: Colors.gray400 },
})
