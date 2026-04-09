// ─────────────────────────────────────────────────────────────────────────────
// Order Detail Screen — realtime status + quotes + customer/provider actions
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Linking,
} from 'react-native'
import { httpsCallable } from 'firebase/functions'
import { firebaseFunctions } from '../../lib/firebase'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useOrdersStore } from '../../stores/ordersStore'
import { useAuth } from '../../hooks/useAuth'
import { Analytics } from '../../lib/analytics'
import { StatusBadge, StatusTimeline, QuoteCard } from '../../components/orders'
import { Button } from '../../components/ui'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow, IconSize } from '../../constants/theme'
import { formatDate, formatPrice } from '@workfix/utils'

export default function OrderDetailScreen() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const { id }   = useLocalSearchParams<{ id: string }>()
  const { isCustomer, isProvider, user } = useAuth()
  const {
    activeOrder, activeQuotes, orderLoading, actionLoading,
    loadOrderDetail, acceptQuote, confirmCompletion, cancelOrder,
    markComplete, clearError,
  } = useOrdersStore()

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason,    setCancelReason]    = useState('')
  const [invoiceLoading,  setInvoiceLoading]  = useState(false)

  useEffect(() => {
    if (id) void loadOrderDetail(id)
  }, [id])

  if (orderLoading || !activeOrder) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    )
  }

  const o             = activeOrder
  const canChat       = ['confirmed', 'in_progress', 'completed'].includes(o.status)
  const canCancel     = ['pending', 'quoted'].includes(o.status)
  const canConfirm    = o.status === 'completed' && isCustomer
  const canDispute    = o.status === 'completed' && isCustomer
  const canMarkDone   = o.status === 'in_progress' && isProvider && o.providerId === user?.uid

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleAcceptQuote(quoteId: string) {
    clearError()
    try {
      const payment = await acceptQuote({ orderId: o.id, quoteId })
      if (payment) Analytics.quoteAccepted(o.id, payment.amount, payment.currency)
      if (payment) {
        router.push({
          pathname: '/orders/payment',
          params: { orderId: o.id, amount: String(payment.amount), currency: payment.currency },
        })
      }
    } catch { /* error shown below */ }
  }

  async function handleRejectQuote(_quoteId: string) {
    // Quotes are rejected server-side atomically when the customer accepts another quote.
    // For explicit "I don't want any of these" we cancel the whole order.
    Alert.alert(t('orders.rejectQuote'), t('orders.rejectQuoteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('orders.rejectQuote'), style: 'destructive',
        onPress: () => setShowCancelModal(true),
      },
    ])
  }

  async function handleMarkComplete() {
    Alert.alert(t('orders.markComplete'), t('orders.markCompleteDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('orders.markComplete'), style: 'default',
        onPress: async () => {
          try {
            await markComplete(o.id)
          } catch { /* error shown via actionError */ }
        },
      },
    ])
  }

  async function handleConfirmCompletion() {
    Alert.alert(t('orders.confirmDone'), t('orders.confirmDoneDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('orders.confirmDone'), style: 'default',
        onPress: async () => {
          try {
            await confirmCompletion(o.id)
            Analytics.orderCompleted(o.id)
            router.push({ pathname: '/orders/review', params: { orderId: o.id } })
          } catch { /* error from store */ }
        },
      },
    ])
  }

  async function handleCancel() {
    if (cancelReason.trim().length < 5) return
    try {
      await cancelOrder({ orderId: o.id, reason: cancelReason.trim() })
      setShowCancelModal(false)
      router.back()
    } catch { /* error from store */ }
  }


  const generateInvoiceFn = httpsCallable<
    { orderId: string },
    { invoiceUrl: string; invoiceNumber: string; cached: boolean }
  >(firebaseFunctions, 'generateInvoice')

  async function handleDownloadInvoice() {
    if (!o) return
    setInvoiceLoading(true)
    try {
      const res = await generateInvoiceFn({ orderId: o.id })
      const { invoiceUrl } = res.data
      await Linking.openURL(invoiceUrl)
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : t('common.retry')
      )
    } finally {
      setInvoiceLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <ScreenHeader
          title={`#${o.id.slice(-6).toUpperCase()}`}
          rightEl={<StatusBadge status={o.status} />}
        />

        {/* ── Timeline ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <StatusTimeline currentStatus={o.status} />
        </View>

        {/* ── Order info ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.section_title}>{t('orders.details')}</Text>
          <View style={styles.info_rows}>
            <InfoRow label={t('orders.descriptionLabel')} value={o.description} />
            <InfoRow label={t('orders.addressLabel')}     value={o.address} />
            <InfoRow
              label={t('orders.createdAt')}
              value={formatDate(o.createdAt, 'ar', 'datetime')}
            />
            {o.isScheduled && o.scheduledAt && (
              <InfoRow
                label={t('orders.scheduledAt')}
                value={formatDate(o.scheduledAt, 'ar', 'datetime')}
              />
            )}
            {o.finalPrice != null && (
              <InfoRow
                label={t('orders.price')}
                value={formatPrice(o.finalPrice, o.currency ?? 'SAR', 'ar')}
                highlight
              />
            )}
          </View>
        </View>

        {/* ── Payment status ─────────────────────────────────────────── */}
        {o.paymentStatus !== 'unpaid' && (
          <View style={styles.section}>
            <View style={styles.payment_banner}>
              <Text style={styles.payment_emoji}>
                {o.paymentStatus === 'held'     ? '🔒' :
                 o.paymentStatus === 'captured' ? '✅' :
                 o.paymentStatus === 'refunded' ? '↩️' : '💳'}
              </Text>
              <View>
                <Text style={styles.payment_label}>{t(`payment.status_${o.paymentStatus}`)}</Text>
                {o.finalPrice && (
                  <Text style={styles.payment_amount}>
                    {formatPrice(o.finalPrice, o.currency ?? 'SAR', 'ar')}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── Quotes (customer sees all, provider sees own) ────────────── */}
        {activeQuotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.section_title}>
              {t('orders.quotes')} ({activeQuotes.length})
            </Text>
            <View style={styles.quotes_list}>
              {activeQuotes.map(q => (
                <QuoteCard
                  key={q.id}
                  quote={q}
                  isCustomer={isCustomer}
                  onAccept={['pending', 'quoted'].includes(o.status) ? handleAcceptQuote : undefined}
                  onReject={['pending', 'quoted'].includes(o.status) ? handleRejectQuote : undefined}
                  isLoading={actionLoading}
                />
              ))}
            </View>
          </View>
        )}

        {activeQuotes.length === 0 && o.status === 'pending' && (
          <View style={styles.section}>
            <View style={styles.waiting_box}>
              <Text style={styles.waiting_emoji}>⏳</Text>
              <Text style={styles.waiting_text}>{t('orders.waitingForQuotes')}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Sticky action bar ─────────────────────────────────────────── */}
      <View style={styles.action_bar}>
        {/* ── Download Invoice (closed orders only) ──────────────────── */}
        {o.status === 'closed' && (
          <Button
            label={invoiceLoading ? t('a11y.loading') : t('orders.downloadInvoice')}
            onPress={handleDownloadInvoice}
            isLoading={invoiceLoading}
            variant="outline"
            style={styles.invoice_btn}
          />
        )}

        {canChat && (
          <TouchableOpacity
            style={styles.chat_btn}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: o.id } })}
          >
            <Text style={styles.chat_icon}>💬</Text>
          </TouchableOpacity>
        )}

        {canMarkDone && (
          <Button
            label={t('orders.markComplete')}
            onPress={handleMarkComplete}
            isLoading={actionLoading}
            style={styles.main_action}
          />
        )}

        {canConfirm && (
          <Button
            label={t('orders.confirmDone')}
            onPress={handleConfirmCompletion}
            isLoading={actionLoading}
            style={styles.main_action}
          />
        )}

        {canDispute && !canConfirm && (
          <Button
            label={t('orders.raiseDispute')}
            onPress={() => router.push({
              pathname: '/orders/dispute',
              params: { orderId: o.id },
            })}
            variant="outline"
            style={styles.main_action}
          />
        )}

        {canCancel && (
          <Button
            label={t('common.cancel')}
            onPress={() => setShowCancelModal(true)}
            variant="ghost"
            style={{ flex: 0, paddingHorizontal: Spacing.lg }}
          />
        )}
      </View>
    </View>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, highlight && infoStyles.value_highlight]}>
        {value}
      </Text>
    </View>
  )
}

const infoStyles = StyleSheet.create({
  row:             { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label:           { fontSize: FontSize.sm, color: Colors.gray500, flex: 0.4 },
  value:           { fontSize: FontSize.sm, color: Colors.black, flex: 0.6, textAlign: 'right' },
  value_highlight: { fontWeight: FontWeight.bold, color: Colors.primary, fontSize: FontSize.md },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading:   { flex: 1, alignItems: 'center', justifyContent: 'center' },


  section: {
    backgroundColor: Colors.white, margin: Spacing.md,
    borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  section_title: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: 4 },
  info_rows:     { gap: 0 },

  payment_banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  payment_emoji:  { fontSize: IconSize.xl },
  payment_label:  { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.black },
  payment_amount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },

  quotes_list:  { gap: Spacing.md },
  waiting_box:  { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  waiting_emoji: { fontSize: IconSize.xl },
  waiting_text:  { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center' },

  action_bar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.lg, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border, ...Shadow.lg,
  },
  main_action: { flex: 1 },
  invoice_btn: { flex: 1 },
  chat_btn: {
    width: 52, height: 52, borderRadius: Radius.md,
    backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  chat_icon: { fontSize: IconSize.md },
})
