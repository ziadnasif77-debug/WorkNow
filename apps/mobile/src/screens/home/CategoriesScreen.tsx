// ─────────────────────────────────────────────────────────────────────────────
// Categories Screen — full grid of all service categories
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMarketplaceStore } from '../../stores/marketplaceStore'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'

export default function CategoriesScreen() {
  const { t, i18n } = useTranslation()
  const router       = useRouter()
  const lang         = (i18n.language === 'ar' ? 'ar' : 'en') as 'ar' | 'en'
  const { categories, categoriesLoading, loadCategories } = useMarketplaceStore()

  useEffect(() => { void loadCategories() }, [])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.back_icon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('home.categories')}</Text>
      </View>

      {categoriesLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
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
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.cat_card}
              onPress={() => router.push(`/search?cat=${item.id}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.cat_icon}>{item.icon ?? '🔧'}</Text>
              <Text style={styles.cat_name}>{item.name[lang]}</Text>
              {item.serviceCount != null && (
                <Text style={styles.cat_count}>{item.serviceCount} خدمة</Text>
              )}
            </TouchableOpacity>
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
  back:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  back_icon: { fontSize: 22, color: Colors.black },
  title:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  grid:  { padding: Spacing.md, gap: Spacing.md },
  row:   { gap: Spacing.md },
  cat_card: {
    flex: 1, backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
    minHeight: 120,
  },
  cat_icon:  { fontSize: 36 },
  cat_name:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black, textAlign: 'center' },
  cat_count: { fontSize: FontSize.xs, color: Colors.gray400 },
})
