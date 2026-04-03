// ─────────────────────────────────────────────────────────────────────────────
// Provider Dashboard Screen — incoming orders list + submit quote sheet
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useOrdersStore } from '../../stores/ordersStore'
import { useAuth } from '../../hooks/useAuth'
import { StatusBadge } from '../../components/orders'
import { EmptyState } from '../../components/marketplace'
import { Button, Input } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'
import { formatDate } from '@workfix/utils'
import type { Order } from '@workfix/types'

export default function ProviderDashboardScreen() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const { user } = useAuth()
  const {
    incomingOrders, incomingLoading,
    subscribeIncomingOrders, unsubscribeAll,
    submitQuote, actionLoading, actionError, clearError } = useOrdersStore()

  const [quoteModal,  setQuoteModal]  = useState(false)
  const [targetOrder, setTargetOrder] = useState<Order | null>(null)
  const [price,       setPrice]       = useState('')
  const [duration,    setDuration]    = useState('')
  const [note,        setNote]        = useState('')
  const [priceErr,    setPriceErr]    = useState('')

  useEffect(() => {
    if (user?.uid) subscribeIncomingOrders(user.uid)
    return () => unsubscribeAll()
  }, [user?.uid])

  function openQuoteModal(order: Order) {
    setTargetOrder(order)
    setPrice('')
    setDuration('')
    setNote('')
    setPriceErr('')
    clearError()
    setQuoteModal(true)
  }

  async function handleSubmitQuote() {
    if (!targetOrder) return
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) {
      setPriceErr(t('errors.invalidPrice'))
      return
    }
    const durationNum = parseInt(duration)
    if (isNaN(durationNum) || durationNum <= 0) {
      setPriceErr(t('errors.invalidDuration'))
      return
    }
    try {
      await submitQuote({
        orderId:                  targetOrder.id,
        price:                    priceNum,
        estimatedDurationMinutes: durationNum,
        note:                     note.trim() || undefined })
      setQuoteModal(false)
      Alert.alert('✓', t('orders.quoteSentSuccess'))
    } catch { /* error from store */ }
  }

  // Group by status
  const active   = incomingOrders.filter(o => ['pending', 'quoted'].includes(o.status))
  const ongoing  = incomingOrders.filter(o => ['confirmed', 'in_progress'].includes(o.status))
  const history  = incomingOrders.filter(o => ['completed', 'closed', 'cancelled'].includes(o.status))

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('provider.dashboard')}</Text>
        <View style={styles.stats_pill}>
          <Text style={styles.stats_text}>{active.length} {t('provider.newRequests')}</Text>
        </View>
      </View>

      {incomingLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : incomingOrders.length === 0 ? (
        <EmptyState
          emoji="📭"
          title={t('provider.noOrders')}
          subtitle={t('provider.noOrdersDesc')}
        />
      ) : (
        <FlatList
          data={[
            ...(active.length  > 0 ? [{ type: 'header' as const, title: t('provider.newRequests'), count: active.length },  ...active ]  : []),
            ...(ongoing.length > 0 ? [{ type: 'header' as const, title: t('provider.ongoing'),     count: ongoing.length }, ...ongoing ] : []),
            ...(history.length > 0 ? [{ type: 'header' as const, title: t('provider.history'),     count: history.length }, ...history ] : []),
          ]}
          keyExtractor={item => 'type' in item ? item.title : item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if ('type' in item) {
              return (
                <View style={styles.section_header}>
                  <Text style={styles.section_title}>{item.title}</Text>
                  <View style={styles.count_badge}>
                    <Text style={styles.count_text}>{item.count}</Text>
                  </View>
                </View>
              )
            }
            return (
              <IncomingOrderCard
                order={item}
                onViewDetail={() => router.push({ pathname: '/orders/[id]', params: { id: item.id } })}
                onSendQuote={item.status === 'pending' ? () => openQuoteModal(item) : undefined}
              />
            )
          }}
        />
      )}

      {/* ── Quote Modal ──────────────────────────────────────────────────── */}
      <Modal visible={quoteModal} animationType="slide" transparent onRequestClose={() => setQuoteModal(false)}>
        <View style={styles.modal_overlay}>
          <View style={styles.modal_sheet}>
            <View style={styles.modal_handle} />
            <Text style={styles.modal_title}>{t('provider.sendQuote')}</Text>

            {targetOrder && (
              <View style={styles.order_preview}>
                <Text style={styles.order_preview_id}>#{targetOrder.id.slice(-6).toUpperCase()}</Text>
                <Text style={styles.order_preview_desc} numberOfLines={2}>{targetOrder.description}</Text>
                <Text style={styles.order_preview_addr}>📍 {targetOrder.address}</Text>
              </View>
            )}

            <Input
              label={t('provider.quotePrice') + ' (SAR)'}
              value={price}
              onChangeText={v => { setPrice(v); setPriceErr('') }}
              keyboardType="decimal-pad"
              error={priceErr}
              placeholder="0.00"
            />
            <Input
              label={t('provider.quoteDuration')}
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
              placeholder="60"
            />
            <Input
              label={t('provider.quoteNote')}
              value={note}
              onChangeText={setNote}
              placeholder={t('provider.quoteNotePlaceholder')}
              multiline
            />

            {actionError && (
              <Text style={styles.modal_error}>{actionError}</Text>
            )}

            <View style={styles.modal_actions}>
              <Button label={t('provider.sendQuote')} onPress={handleSubmitQuote} isLoading={actionLoading} />
              <Button label={t('common.cancel')} onPress={() => setQuoteModal(false)} variant="ghost" />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function IncomingOrderCard({
  order, onViewDetail, onSendQuote }: {
  order: Order
  onViewDetail: () => void
  onSendQuote?: () => void
}) {
  const { t } = useTranslation()

  return (
    <TouchableOpacity style={styles.order_card} onPress={onViewDetail} activeOpacity={0.85}>
      <View style={styles.order_top}>
        <Text style={styles.order_id}>#{order.id.slice(-6).toUpperCase()}</Text>
        <StatusBadge status={order.status} size="sm" />
      </View>
      <Text style={styles.order_desc} numberOfLines={2}>{order.description}</Text>
      <View style={styles.order_meta}>
        <Text style={styles.order_addr} numberOfLines={1}>📍 {order.address}</Text>
        <Text style={styles.order_time}>{formatDate(order.createdAt, 'ar', 'relative')}</Text>
      </View>
      {onSendQuote && (
        <TouchableOpacity style={styles.quote_btn} onPress={onSendQuote}>
          <Text style={styles.quote_btn_text}>💬 {t('provider.sendQuote')}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:      { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },
  stats_pill: { backgroundColor: Colors.primaryLight, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  stats_text: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },

  list: { padding: Spacing.md, gap: Spacing.sm },
  section_header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: 4 },
  section_title:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray700 },
  count_badge:    { backgroundColor: Colors.gray200, borderRadius: Radius.full, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  count_text:     { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.gray600 },

  order_card: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  order_top:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  order_id:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  order_desc: { fontSize: FontSize.md, color: Colors.gray700, lineHeight: 20 },
  order_meta: { flexDirection: 'row', justifyContent: 'space-between' },
  order_addr: { fontSize: FontSize.sm, color: Colors.gray500, flex: 1 },
  order_time: { fontSize: FontSize.xs, color: Colors.gray400 },
  quote_btn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center' },
  quote_btn_text: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  // Modal
  modal_overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal_sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  modal_handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.gray200, alignSelf: 'center', marginBottom: Spacing.sm },
  modal_title:  { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  order_preview: { backgroundColor: Colors.gray50, borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  order_preview_id:   { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray600 },
  order_preview_desc: { fontSize: FontSize.md, color: Colors.black },
  order_preview_addr: { fontSize: FontSize.sm, color: Colors.gray500 },
  modal_error:    { color: Colors.error, fontSize: FontSize.sm },
  modal_actions:  { gap: Spacing.sm } })
