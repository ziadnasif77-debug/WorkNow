// ─────────────────────────────────────────────────────────────────────────────
// Subscriptions Screen — provider plan upgrade
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Analytics } from '../../lib/analytics'
import { usePaymentsStore } from '../../stores/paymentsStore'
import { Button, Screen } from '../../components/ui'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize } from '../../constants/theme'
import type { SubscriptionTier } from '@workfix/types'

interface Plan {
  tier:        SubscriptionTier
  priceMonthly: number
  priceYearly:  number
  color:        string
  emoji:        string
  features:     string[]
  popular?:     boolean
}

const PLANS: Plan[] = [
  {
    tier: 'free', priceMonthly: 0, priceYearly: 0,
    color: Colors.gray500, emoji: '🆓',
    features: ['orders.free.f1', 'orders.free.f2', 'orders.free.f3'],
  },
  {
    tier: 'pro', priceMonthly: 99, priceYearly: 999,
    color: Colors.primary, emoji: '⚡', popular: true,
    features: ['orders.pro.f1', 'orders.pro.f2', 'orders.pro.f3', 'orders.pro.f4'],
  },
  {
    tier: 'business', priceMonthly: 299, priceYearly: 2999,
    color: Colors.purple, emoji: '👑',
    features: ['orders.biz.f1', 'orders.biz.f2', 'orders.biz.f3', 'orders.biz.f4', 'orders.biz.f5'],
  },
]

const PLAN_FEATURES: Record<string, { ar: string; en: string }> = {
  'orders.free.f1': { ar: '5 طلبات شهرياً', en: '5 orders/month' },
  'orders.free.f2': { ar: 'ظهور عادي في البحث', en: 'Standard visibility' },
  'orders.free.f3': { ar: 'دعم عبر البريد', en: 'Email support' },
  'orders.pro.f1':  { ar: 'طلبات غير محدودة', en: 'Unlimited orders' },
  'orders.pro.f2':  { ar: 'أولوية في نتائج البحث', en: 'Priority in search results' },
  'orders.pro.f3':  { ar: 'إحصاءات متقدمة', en: 'Advanced analytics' },
  'orders.pro.f4':  { ar: 'دعم سريع', en: 'Priority support' },
  'orders.biz.f1':  { ar: 'كل ميزات Pro', en: 'All Pro features' },
  'orders.biz.f2':  { ar: 'شارة موثّق مميزة', en: 'Verified business badge' },
  'orders.biz.f3':  { ar: 'نسبة عمولة مخفضة (8%)', en: 'Reduced commission (8%)' },
  'orders.biz.f4':  { ar: 'مدير حساب مخصص', en: 'Dedicated account manager' },
  'orders.biz.f5':  { ar: 'API مباشر', en: 'Direct API access' },
}

export default function SubscriptionsScreen() {
  const { t, i18n } = useTranslation()
  const router      = useRouter()
  const { createSubscription } = usePaymentsStore.getState()
  const lang        = (i18n.language === 'ar' ? 'ar' : 'en') as 'ar' | 'en'

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('pro')
  const [billing,      setBilling]      = useState<'monthly' | 'yearly'>('monthly')
  const [isLoading,    setIsLoading]    = useState(false)

  const selectedPlan = PLANS.find(p => p.tier === selectedTier)!
  const price = billing === 'monthly'
    ? selectedPlan.priceMonthly
    : Math.round(selectedPlan.priceYearly / 12)

  async function handleSubscribe() {
    if (selectedTier === 'free') {
      Alert.alert(t('subscriptions.alreadyFree'))
      return
    }
    setIsLoading(true)
    try {
      const res = await createSubscription(selectedTier, billing)

      Analytics.subscriptionStarted(selectedTier, billing)
      if (res.redirectUrl) {
        router.push({
          pathname: '/orders/payment-webview',
          params: { url: res.redirectUrl, orderId: 'subscription' },
        })
      } else {
        Alert.alert('✓', t('subscriptions.activated'))
        router.back()
      }
    } catch {
      Alert.alert(t('common.error'), t('subscriptions.failed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Screen scroll padded={false}>
      <ScreenHeader title={t('subscriptions.title')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Billing toggle */}
        <View style={styles.billing_toggle}>
          {(['monthly', 'yearly'] as const).map(b => (
            <TouchableOpacity
              key={b}
              style={[styles.billing_btn, billing === b && styles.billing_btn_active]}
              onPress={() => setBilling(b)}
            >
              <Text style={[styles.billing_label, billing === b && styles.billing_label_active]}>
                {t(`subscriptions.${b}`)}
              </Text>
              {b === 'yearly' && (
                <View style={styles.save_badge}>
                  <Text style={styles.save_text}>{t('subscriptions.save30')}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Plans */}
        {PLANS.map(plan => {
          const planPrice = billing === 'monthly' ? plan.priceMonthly : Math.round(plan.priceYearly / 12)
          const isSelected = selectedTier === plan.tier

          return (
            <TouchableOpacity
              key={plan.tier}
              style={[
                styles.plan_card,
                isSelected && { borderColor: plan.color, borderWidth: 2 },
                plan.popular && styles.plan_popular,
              ]}
              onPress={() => setSelectedTier(plan.tier)}
              activeOpacity={0.85}
            >
              {plan.popular && (
                <View style={[styles.popular_badge, { backgroundColor: plan.color }]}>
                  <Text style={styles.popular_text}>{t('subscriptions.mostPopular')}</Text>
                </View>
              )}

              <View style={styles.plan_header}>
                <Text style={styles.plan_emoji}>{plan.emoji}</Text>
                <View style={styles.plan_name_wrap}>
                  <Text style={[styles.plan_name, { color: plan.color }]}>
                    {t(`subscriptions.tier_${plan.tier}`)}
                  </Text>
                  <Text style={styles.plan_price}>
                    {planPrice === 0
                      ? t('subscriptions.free')
                      : `${planPrice} ${t('common.sar')}/${t('subscriptions.month')}`
                    }
                  </Text>
                </View>
                <View style={[styles.plan_radio, isSelected && { borderColor: plan.color }]}>
                  {isSelected && <View style={[styles.plan_radio_inner, { backgroundColor: plan.color }]} />}
                </View>
              </View>

              {billing === 'yearly' && plan.priceYearly > 0 && (
                <Text style={styles.yearly_note}>
                  {t('subscriptions.billedAs', { total: plan.priceYearly })}
                </Text>
              )}

              <View style={styles.features_list}>
                {plan.features.map(fKey => (
                  <View key={fKey} style={styles.feature_row}>
                    <Text style={[styles.feature_check, { color: plan.color }]}>✓</Text>
                    <Text style={styles.feature_text}>
                      {PLAN_FEATURES[fKey]?.[lang] ?? fKey}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          )
        })}

        {/* CTA */}
        <Button
          label={
            selectedTier === 'free'
              ? t('subscriptions.keepFree')
              : t('subscriptions.subscribe', { tier: t(`subscriptions.tier_${selectedTier}`) })
          }
          onPress={handleSubscribe}
          isLoading={isLoading}
          style={styles.cta_btn}
        />

        <Text style={styles.cancel_note}>{t('subscriptions.cancelAnytime')}</Text>
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },

  billing_toggle: {
    flexDirection: 'row', gap: 0,
    backgroundColor: Colors.gray100, borderRadius: Radius.md, padding: Spacing.xs,
  },
  billing_btn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, borderRadius: Radius.sm },
  billing_btn_active: { backgroundColor: Colors.white },
  billing_label:      { fontSize: FontSize.md, color: Colors.gray500, fontWeight: FontWeight.medium },
  billing_label_active: { color: Colors.black, fontWeight: FontWeight.bold },
  save_badge: { backgroundColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: Spacing.xs, paddingVertical: Spacing.xxs },
  save_text:  { fontSize: 9, color: Colors.white, fontWeight: FontWeight.bold },

  plan_card: {
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
    overflow: 'hidden', position: 'relative',
  },
  plan_popular: { marginTop: Spacing.sm },
  popular_badge: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderBottomStartRadius: Radius.md,
  },
  popular_text: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  plan_header:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  plan_emoji:     { fontSize: IconSize.xl },
  plan_name_wrap: { flex: 1 },
  plan_name:      { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  plan_price:     { fontSize: FontSize.sm, color: Colors.gray500, marginTop: Spacing.xxs },
  plan_radio: {
    width: 22, height: 22, borderRadius: Radius.full,
    borderWidth: 2, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  plan_radio_inner: { width: 10, height: 10, borderRadius: Radius.full },
  yearly_note:    { fontSize: FontSize.xs, color: Colors.gray400 },

  features_list:  { gap: Spacing.sm },
  feature_row:    { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  feature_check:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, width: IconSize.md },
  feature_text:   { flex: 1, fontSize: FontSize.sm, color: Colors.gray700, lineHeight: 20 },

  cta_btn:     { marginTop: Spacing.sm },
  cancel_note: { fontSize: FontSize.xs, color: Colors.gray400, textAlign: 'center' },
})
