// ─────────────────────────────────────────────────────────────────────────────
// Payment Screen — method selection + Tap Payments WebView checkout
// Shows only methods available in the user's country
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { usePaymentsStore } from '../../stores/paymentsStore'
import { useIsOnline } from '../../hooks/useNetworkState'
import { Analytics } from '../../lib/analytics'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Button, Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'
import { formatPrice } from '@workfix/utils'
import type { PaymentMethod, Currency } from '@workfix/types'
import { useLocation } from '../../hooks/useLocation'

// ── Method config ─────────────────────────────────────────────────────────────

interface MethodConfig {
  key:     PaymentMethod
  label:   string
  emoji:   string
  hint?:   string
  countries: string[]   // ISO codes where available
}

const ALL_METHODS: MethodConfig[] = [
  { key: 'card',      label: 'payment.card',     emoji: '💳', countries: ['SA','AE','KW','QA','BH','OM','EG','NO','SE'] },
  { key: 'apple_pay', label: 'payment.applePay',  emoji: '🍎', countries: ['SA','AE','KW','QA','BH','OM','NO','SE'] },
  { key: 'stc_pay',   label: 'payment.stcPay',    emoji: '📱', hint: 'STC Pay', countries: ['SA'] },
  { key: 'mada',      label: 'payment.mada',      emoji: '🏦', hint: 'Mada', countries: ['SA'] },
  { key: 'vipps',     label: 'payment.vipps',     emoji: '💜', hint: 'Vipps', countries: ['NO'] },
  { key: 'swish',     label: 'payment.swish',     emoji: '💚', hint: 'Swish', countries: ['SE'] },
  { key: 'cash',      label: 'payment.cash',      emoji: '💵', countries: ['SA','AE','KW','QA','BH','OM','EG'] },
]

export default function PaymentScreen() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const location = useLocation()
  const isOnline  = useIsOnline()
  const { orderId, amount, currency } = useLocalSearchParams<{
    orderId: string
    amount:  string
    currency?: string
  }>()

  const { initiatePayment, isInitiating, initError, clearErrors } = usePaymentsStore()
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)

  const amountNum  = parseFloat(amount ?? '0')
  const curr       = (currency ?? 'SAR') as Currency
  const countryCode = location.country.toUpperCase()

  // Filter methods for current country
  const availableMethods = ALL_METHODS.filter(m =>
    m.countries.includes(countryCode),
  )

  async function handlePay() {
    if (!selectedMethod || !orderId) return
    if (!isOnline) { Alert.alert(t('common.error'), 'لا يوجد اتصال بالإنترنت'); return }
    clearErrors()
    Analytics.paymentStarted(orderId, selectedMethod, total)

    try {
      if (selectedMethod === 'cash') {
        await initiatePayment(orderId, 'cash')
        router.replace({ pathname: '/orders/[id]', params: { id: orderId } })
        return
      }

      const redirectUrl = await initiatePayment(
        orderId,
        selectedMethod,
        `workfix://payment/callback?orderId=${orderId}`,
      )

      if (redirectUrl) {
        // Open Tap checkout WebView
        router.push({
          pathname: '/orders/payment-webview',
          params: { url: redirectUrl, orderId } })
      }
    } catch { /* error from store */ }
  }

  const commissionRate = 0.12
  const commission     = Math.round(amountNum * commissionRate * 100) / 100
  const vatRate        = countryCode === 'SA' ? 0.15 : 0
  const vat            = Math.round(amountNum * vatRate * 100) / 100
  const total          = amountNum + vat

  return (
    <Screen scroll avoidKeyboard padded={false}>
      {/* Header */}
      <ScreenHeader title={t('payment.title')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Amount summary ────────────────────────────────────────────── */}
        <View style={styles.amount_card}>
          <View style={styles.amount_row}>
            <Text style={styles.amount_label}>{t('payment.serviceAmount')}</Text>
            <Text style={styles.amount_val}>{formatPrice(amountNum, curr, 'ar')}</Text>
          </View>
          {vat > 0 && (
            <View style={styles.amount_row}>
              <Text style={styles.amount_label}>{t('payment.vat')} (15%)</Text>
              <Text style={styles.amount_val}>{formatPrice(vat, curr, 'ar')}</Text>
            </View>
          )}
          <View style={styles.amount_divider} />
          <View style={styles.amount_row}>
            <Text style={styles.amount_total_label}>{t('payment.total')}</Text>
            <Text style={styles.amount_total}>{formatPrice(total, curr, 'ar')}</Text>
          </View>

          {/* Escrow notice */}
          <View style={styles.escrow_notice}>
            <Text style={styles.escrow_icon}>🔒</Text>
            <Text style={styles.escrow_text}>{t('payment.escrowNote')}</Text>
          </View>
        </View>

        {/* ── Payment methods ───────────────────────────────────────────── */}
        <Text style={styles.section_title}>{t('payment.method')}</Text>

        <View style={styles.methods_list}>
          {availableMethods.map(method => (
            <TouchableOpacity
              key={method.key}
              style={[
                styles.method_card,
                selectedMethod === method.key && styles.method_card_selected,
              ]}
              onPress={() => setSelectedMethod(method.key)}
              activeOpacity={0.85}
            >
              <Text style={styles.method_emoji}>{method.emoji}</Text>
              <View style={styles.method_info}>
                <Text style={[
                  styles.method_label,
                  selectedMethod === method.key && styles.method_label_selected,
                ]}>
                  {t(method.label)}
                </Text>
                {method.hint && (
                  <Text style={styles.method_hint}>{method.hint}</Text>
                )}
                {method.key === 'cash' && (
                  <Text style={styles.method_hint}>{t('payment.cashHint')}</Text>
                )}
              </View>
              <View style={[
                styles.radio,
                selectedMethod === method.key && styles.radio_selected,
              ]}>
                {selectedMethod === method.key && <View style={styles.radio_inner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Error */}
        {initError && (
          <View style={styles.error_box}>
            <Text style={styles.error_text}>{initError}</Text>
          </View>
        )}

        {/* Terms */}
        <Text style={styles.terms}>{t('payment.terms')}</Text>

      </ScrollView>

      {/* ── Pay button (sticky) ───────────────────────────────────────── */}
      <View style={styles.cta_bar}>
        <Button
          label={`${t('payment.payNow')} — ${formatPrice(total, curr, 'ar')}`}
          onPress={handlePay}
          isLoading={isInitiating}
          disabled={!selectedMethod}
          style={styles.pay_btn}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },

  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 120 },

  amount_card: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  amount_row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount_label:        { fontSize: FontSize.md, color: Colors.gray500 },
  amount_val:          { fontSize: FontSize.md, color: Colors.black, fontWeight: FontWeight.medium },
  amount_divider:      { height: 1, backgroundColor: Colors.border },
  amount_total_label:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },
  amount_total:        { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },

  escrow_notice: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.md,
    padding: Spacing.md, marginTop: Spacing.sm },
  escrow_icon: { fontSize: 18 },
  escrow_text: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, lineHeight: 18 },

  section_title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },

  methods_list: { gap: Spacing.md },
  method_card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border },
  method_card_selected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  method_emoji:         { fontSize: 28 },
  method_info:          { flex: 1, gap: 2 },
  method_label:         { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.black },
  method_label_selected:{ color: Colors.primary, fontWeight: FontWeight.bold },
  method_hint:          { fontSize: FontSize.xs, color: Colors.gray400 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center' },
  radio_selected: { borderColor: Colors.primary },
  radio_inner:    { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  error_box:  { backgroundColor: Colors.errorLight, borderRadius: Radius.sm, padding: Spacing.md },
  error_text: { color: Colors.error, fontSize: FontSize.sm },

  terms: { fontSize: FontSize.xs, color: Colors.gray400, textAlign: 'center', lineHeight: 18 },

  cta_bar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.lg, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border, ...Shadow.lg },
  pay_btn: {} })
