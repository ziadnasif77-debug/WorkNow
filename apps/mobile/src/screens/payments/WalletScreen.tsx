// ─────────────────────────────────────────────────────────────────────────────
// Provider Wallet Screen — balance overview + request payout
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  Alert, Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { usePaymentsStore } from '../../stores/paymentsStore'
import { useAuth } from '../../hooks/useAuth'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Button, Card, ErrorBanner, Input, LoadingState, Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow, IconSize } from '../../constants/theme'
import { formatPrice } from '@workfix/utils'

export default function WalletScreen() {
  const { t }     = useTranslation()
  const router    = useRouter()
  const { user: _user } = useAuth()
  const {
    wallet, walletLoading,
    payoutLoading, payoutError,
    loadWallet, requestPayout, clearErrors,
  } = usePaymentsStore()

  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutAmount,    setPayoutAmount]    = useState('')
  const [amountErr,       setAmountErr]       = useState('')

  useEffect(() => { void loadWallet() }, [])

  const currency = wallet?.currency ?? 'SAR'

  async function handleRequestPayout() {
    const amt = payoutAmount.trim() ? parseFloat(payoutAmount) : undefined

    if (amt !== undefined) {
      if (isNaN(amt) || amt <= 0) { setAmountErr(t('errors.invalidAmount')); return }
      if (wallet && amt > wallet.availableBalance) {
        setAmountErr(t('errors.insufficientBalance'))
        return
      }
      if (amt < 10) { setAmountErr(t('errors.minPayout')); return }
    }

    clearErrors()
    try {
      await requestPayout(amt)
      setShowPayoutModal(false)
      setPayoutAmount('')
      Alert.alert('✓', t('provider.payoutRequested'))
    } catch { /* error from store */ }
  }

  return (
    <Screen scroll padded={false}>
      {/* Header */}
      <ScreenHeader title={t('provider.wallet')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {walletLoading ? (
          <LoadingState />
        ) : (
          <>
            {/* ── Balance cards ─────────────────────────────────────────── */}
            <View style={styles.balance_hero}>
              <Text style={styles.balance_label}>{t('provider.balance')}</Text>
              <Text style={styles.balance_amount}>
                {formatPrice(wallet?.availableBalance ?? 0, currency, 'ar')}
              </Text>
              <Button
                label={t('provider.requestPayout')}
                onPress={() => setShowPayoutModal(true)}
                disabled={!wallet || wallet.availableBalance < 10}
                style={styles.payout_btn}
              />
            </View>

            <View style={styles.secondary_cards}>
              <Card style={{ flex: 1, alignItems: 'center' }} gap={Spacing.xs}>
                <Text style={styles.secondary_emoji}>⏳</Text>
                <Text style={styles.secondary_label}>{t('provider.pending')}</Text>
                <Text style={styles.secondary_amount}>
                  {formatPrice(wallet?.pendingBalance ?? 0, currency, 'ar')}
                </Text>
              </Card>
              <Card style={{ flex: 1, alignItems: 'center' }} gap={Spacing.xs}>
                <Text style={styles.secondary_emoji}>🔄</Text>
                <Text style={styles.secondary_label}>{t('provider.processing')}</Text>
                <Text style={styles.secondary_amount}>
                  {formatPrice(wallet?.processingPayouts ?? 0, currency, 'ar')}
                </Text>
              </Card>
            </View>

            {/* ── How it works ─────────────────────────────────────────── */}
            <Card>
              <Text style={styles.info_title}>{t('provider.howPayoutWorks')}</Text>
              {[
                t('provider.payoutInfo1'),
                t('provider.payoutInfo2'),
                t('provider.payoutInfo3'),
              ].map((info, i) => (
                <View key={i} style={styles.info_row}>
                  <Text style={styles.info_dot}>•</Text>
                  <Text style={styles.info_text}>{info}</Text>
                </View>
              ))}
            </Card>

            {/* ── Bank account reminder ─────────────────────────────────── */}
            <Card onPress={() => router.push('/profile/bank-account' as never)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.bank_emoji}>🏦</Text>
              <View style={styles.bank_info}>
                <Text style={styles.bank_title}>{t('provider.bankAccount')}</Text>
                <Text style={styles.bank_desc}>{t('provider.bankAccountDesc')}</Text>
              </View>
              <Text style={styles.bank_arrow}>›</Text>
            </Card>
          </>
        )}
      </ScrollView>

      {/* ── Payout Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={showPayoutModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPayoutModal(false)}
      >
        <View style={styles.modal_overlay}>
          <View style={styles.modal_sheet}>
            <View style={styles.modal_handle} />
            <Text style={styles.modal_title}>{t('provider.requestPayout')}</Text>

            <View style={styles.modal_balance}>
              <Text style={styles.modal_balance_label}>{t('provider.balance')}</Text>
              <Text style={styles.modal_balance_amount}>
                {formatPrice(wallet?.availableBalance ?? 0, currency, 'ar')}
              </Text>
            </View>

            <Input
              value={payoutAmount}
              onChangeText={v => { setPayoutAmount(v); setAmountErr('') }}
              keyboardType="decimal-pad"
              placeholder={t('provider.payoutAmountPlaceholder')}
              error={amountErr}
              containerStyle={{ marginBottom: 0 }}
              rightIcon={<Text style={styles.amount_currency}>{currency}</Text>}
            />

            <Text style={styles.full_amount_hint}>
              {t('provider.leaveBlankForFull')}
            </Text>

            <ErrorBanner error={payoutError} />

            <View style={styles.modal_actions}>
              <Button
                label={t('provider.requestPayout')}
                onPress={handleRequestPayout}
                isLoading={payoutLoading}
              />
              <Button
                label={t('common.cancel')}
                onPress={() => { setShowPayoutModal(false); setPayoutAmount('') }}
                variant="ghost"
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  balance_hero: {
    backgroundColor: Colors.primary, borderRadius: Radius.xl,
    padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, ...Shadow.md,
  },
  balance_label:  { fontSize: FontSize.md, color: 'rgba(255,255,255,0.8)' },
  balance_amount: { fontSize: 36, fontWeight: FontWeight.bold, color: Colors.white },
  payout_btn:     { backgroundColor: Colors.white, marginTop: Spacing.sm },

  secondary_cards: { flexDirection: 'row', gap: Spacing.md },
  secondary_emoji:  { fontSize: IconSize.lg },
  secondary_label:  { fontSize: FontSize.xs, color: Colors.gray500 },
  secondary_amount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },

  info_title: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  info_row:   { flexDirection: 'row', gap: Spacing.sm },
  info_dot:   { color: Colors.primary, fontSize: FontSize.md },
  info_text:  { flex: 1, fontSize: FontSize.sm, color: Colors.gray600, lineHeight: 20 },

  bank_emoji: { fontSize: IconSize.xl },
  bank_info:  { flex: 1 },
  bank_title: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  bank_desc:  { fontSize: FontSize.sm, color: Colors.gray500 },
  bank_arrow: { fontSize: IconSize.md, color: Colors.gray400 },

  modal_overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal_sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md,
  },
  modal_handle:         { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.gray200, alignSelf: 'center', marginBottom: Spacing.sm },
  modal_title:          { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  modal_balance:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.gray50, borderRadius: Radius.md, padding: Spacing.md },
  modal_balance_label:  { fontSize: FontSize.md, color: Colors.gray500 },
  modal_balance_amount: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  amount_currency: { paddingHorizontal: Spacing.sm, fontSize: FontSize.md, color: Colors.gray500, fontWeight: FontWeight.medium },
  full_amount_hint: { fontSize: FontSize.xs, color: Colors.gray400 },
  modal_actions:   { gap: Spacing.sm },
})
