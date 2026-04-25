// ─────────────────────────────────────────────────────────────────────────────
// Onboarding Screen — 3 slides shown only on first launch
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, Dimensions,
  TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'
import { Button } from '../../components/ui'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

type MMKVLike = { getBoolean: (k: string) => boolean | undefined; set: (k: string, v: boolean) => void }
let storage: MMKVLike
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { MMKV } = require('react-native-mmkv') as { MMKV: new (opts: { id: string }) => MMKVLike }
  const _mmkv = new MMKV({ id: 'app' })
  storage = { getBoolean: (k) => _mmkv.getBoolean(k), set: (k, v) => _mmkv.set(k, v) }
} catch {
  const _mem: Record<string, boolean> = {}
  storage = { getBoolean: (k) => _mem[k], set: (k, v) => { _mem[k] = v } }
}

interface Slide {
  id:          string
  emoji:       string
  titleKey:    string
  subtitleKey: string
  bg:          string
}

const SLIDES: Slide[] = [
  {
    id: '1', emoji: '🔍', bg: Colors.primaryLight,
    titleKey:    'onboarding.slide1_title',
    subtitleKey: 'onboarding.slide1_sub' },
  {
    id: '2', emoji: '✅', bg: Colors.successLight,
    titleKey:    'onboarding.slide2_title',
    subtitleKey: 'onboarding.slide2_sub' },
  {
    id: '3', emoji: '💳', bg: Colors.orangeLight,
    titleKey:    'onboarding.slide3_title',
    subtitleKey: 'onboarding.slide3_sub' },
]

export default function OnboardingScreen() {
  const { t }     = useTranslation()
  const router    = useRouter()
  const insets    = useSafeAreaInsets()
  const flatRef   = useRef<FlatList>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  function finish() {
    storage.set('onboarding_done', true)
    router.replace('/auth/login')
  }

  function next() {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1 })
      setActiveIndex(i => i + 1)
    } else {
      finish()
    }
  }

  const isLast = activeIndex === SLIDES.length - 1

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(_item, index) => String(index)}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
          setActiveIndex(idx)
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_WIDTH, backgroundColor: item.bg }]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{t(item.titleKey)}</Text>
            <Text style={styles.subtitle}>{t(item.subtitleKey)}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex && styles.dot_active]}
          />
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          label={isLast ? t('auth.getStarted') : t('common.next')}
          onPress={next}
        />
        {!isLast && (
          <TouchableOpacity onPress={finish} style={styles.skip}>
            <Text style={styles.skip_text}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 120,
    gap: Spacing.lg },
  emoji:    { fontSize: 80 },
  title:    { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, textAlign: 'center', color: Colors.black },
  subtitle: { fontSize: FontSize.lg, textAlign: 'center', color: Colors.gray500, lineHeight: 26 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.gray200 },
  dot_active: { width: 24, backgroundColor: Colors.primary },
  actions: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  skip:      { alignItems: 'center', paddingVertical: Spacing.sm },
  skip_text: { color: Colors.gray400, fontSize: FontSize.md } })
