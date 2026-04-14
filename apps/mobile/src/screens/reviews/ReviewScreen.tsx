// ─────────────────────────────────────────────────────────────────────────────
// Review Screen — submit rating + comment after order is closed
// Triggered automatically after confirmCompletion
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Analytics } from '../../lib/analytics'
import { useOrdersStore } from '../../stores/ordersStore'
import { Button, Chip, Screen } from '../../components/ui'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize } from '../../constants/theme'

const REVIEW_TAGS = [
  { key: 'professional',  ar: 'محترف',      en: 'Professional' },
  { key: 'on_time',       ar: 'في الموعد',   en: 'On Time' },
  { key: 'clean_work',    ar: 'عمل نظيف',   en: 'Clean Work' },
  { key: 'good_price',    ar: 'سعر مناسب',  en: 'Good Price' },
  { key: 'recommended',   ar: 'أنصح به',    en: 'Recommended' },
  { key: 'communicative', ar: 'تواصل ممتاز', en: 'Communicative' },
]

export default function ReviewScreen() {
  const { t, i18n } = useTranslation()
  const router      = useRouter()
  const { orderId, providerId, providerName } =
    useLocalSearchParams<{ orderId: string; providerId: string; providerName?: string }>()

  const lang = (i18n.language === 'ar' ? 'ar' : 'en') as 'ar' | 'en'

  const [rating,    setRating]    = useState(0)
  const [hovering,  setHovering]  = useState(0)
  const [comment,   setComment]   = useState('')
  const [tags,      setTags]      = useState<string[]>([])
  const { submitReview } = useOrdersStore()
  const [isLoading, setIsLoading] = useState(false)

  function toggleTag(key: string) {
    setTags(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key],
    )
  }

  async function handleSubmit() {
    if (!orderId || !providerId) { Alert.alert('خطأ', 'معرّف الطلب مفقود'); return }
    if (rating === 0) {
      Alert.alert(t('reviews.ratingRequired'), t('reviews.pleaseRate'))
      return
    }
    setIsLoading(true)
    try {
      await submitReview({
        orderId,
        targetId:   providerId,
        targetType: 'provider',
        rating,
        comment:    comment.trim() || undefined,
        tags,
      })
      void Analytics.reviewSubmitted(rating)
      router.replace({ pathname: '/orders/[id]', params: { id: orderId } })
    } catch {
      Alert.alert(t('common.error'), t('reviews.submitFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const displayRating = hovering || rating

  return (
    <Screen scroll padded={false}>
      <ScreenHeader title={t('reviews.title')} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.subtitle}>
            {t('reviews.subtitle', { name: providerName ?? t('provider.provider') })}
          </Text>
        </View>

        {/* Stars */}
        <View style={styles.stars_section}>
          <View style={styles.stars_row}>
            {[1, 2, 3, 4, 5].map(i => (
              <TouchableOpacity
                key={i}
                onPress={() => setRating(i)}
                onPressIn={() => setHovering(i)}
                onPressOut={() => setHovering(0)}
                style={styles.star_btn}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.star,
                  i <= displayRating && styles.star_filled,
                ]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.rating_label}>
            {displayRating === 0 ? t('reviews.tapToRate') :
             displayRating === 1 ? t('reviews.rating1') :
             displayRating === 2 ? t('reviews.rating2') :
             displayRating === 3 ? t('reviews.rating3') :
             displayRating === 4 ? t('reviews.rating4') :
                                   t('reviews.rating5')}
          </Text>
        </View>

        {/* Tags */}
        {rating >= 3 && (
          <View style={styles.tags_section}>
            <Text style={styles.section_label}>{t('reviews.whatStoodOut')}</Text>
            <View style={styles.tags_wrap}>
              {REVIEW_TAGS.map(tag => (
                <Chip
                  key={tag.key}
                  label={tag[lang]}
                  selected={tags.includes(tag.key)}
                  onPress={() => toggleTag(tag.key)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Comment */}
        <View style={styles.comment_section}>
          <Text style={styles.section_label}>{t('reviews.addComment')}</Text>
          <View style={styles.comment_wrap}>
            <TextInput
              style={styles.comment_input}
              value={comment}
              onChangeText={setComment}
              placeholder={t('reviews.commentPlaceholder')}
              placeholderTextColor={Colors.gray400}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.char_count}>{comment.length}/500</Text>
          </View>
        </View>

        {/* Submit */}
        <Button
          label={t('reviews.submit')}
          onPress={handleSubmit}
          isLoading={isLoading}
          disabled={rating === 0}
          style={styles.submit_btn}
        />

        {/* Skip */}
        <TouchableOpacity
          style={styles.skip_btn}
          onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: orderId } })}
        >
          <Text style={styles.skip_text}>{t('reviews.skipForNow')}</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.xl },

  header:   { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm },
  subtitle: { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center' },

  stars_section: { alignItems: 'center', gap: Spacing.md },
  stars_row:     { flexDirection: 'row', gap: Spacing.sm },
  star_btn:      { padding: 4 },
  star:          { fontSize: IconSize.xxl, color: Colors.gray200 },
  star_filled:   { color: Colors.amber },
  rating_label:  { fontSize: FontSize.lg, color: Colors.gray500, fontWeight: FontWeight.medium },

  tags_section: { gap: Spacing.md },
  section_label: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  tags_wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

  comment_section: { gap: Spacing.md },
  comment_wrap: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.white, padding: Spacing.md,
  },
  comment_input: { fontSize: FontSize.md, color: Colors.black, minHeight: 100, lineHeight: 22 },
  char_count:    { fontSize: FontSize.xs, color: Colors.gray400, textAlign: 'right', marginTop: Spacing.xs },

  submit_btn: {},
  skip_btn:   { alignItems: 'center', paddingVertical: Spacing.sm },
  skip_text:  { fontSize: FontSize.md, color: Colors.gray400 },
})
