// ─────────────────────────────────────────────────────────────────────────────
// My Orders Screen — customer's order list with status filter
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useOrdersStore } from '../../stores/ordersStore'
import { useAuth } from '../../hooks/useAuth'
import { StatusBadge } from '../../components/orders'
import { EmptyState } from '../../components/marketplace'
import { Button } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow, IconSize } from '../../constants/theme'
import { formatDate, formatPrice } from '@workfix/utils'
import type { Order, OrderStatus } from '@workfix/types'

const STATUS_FILTERS: Array<{ key: OrderStatus | 'all'; label: string }> = [
  { key: 'all',         label: 'الكل' },
  { key: 'pending',     label: 'بانتظار' },
  { key: 'confirmed',   label: 'مؤكد' },
  { key: 'in_progress', label: 'جارٍ' },
  { key: 'completed',   label: 'منتهٍ' },
  { key: 'closed',      label: 'مغلق' },
]

export default function MyOrdersScreen() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const insets   = useSafeAreaInsets()
  const { user } = useAuth()
  const { myOrders, ordersLoading, subscribeMyOrders, unsubscribeAll } = useOrdersStore()

  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'all'>('all')

  useEffect(() => {
    if (user?.uid) subscribeMyOrders(user.uid)
    return () => unsubscribeAll()
  }, [user?.uid])

  const filtered = activeFilter === 'all'
    ? myOrders
    : myOrders.filter(o => o.status === activeFilter)

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.title}>{t('orders.title')}</Text>
        <Button
          label={t('orders.newOrder')}
          onPress={() => router.push('/orders/create')}
          size="sm"
          style={styles.new_btn}
          fullWidth={false}
        />
      </View>

      {/* Status filter chips */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={f => f.key}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filter_bar}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filter_chip, activeFilter === item.key && styles.filter_chip_active]}
            onPress={() => setActiveFilter(item.key)}
          >
            <Text style={[
              styles.filter_label,
              activeFilter === item.key && styles.filter_label_active,
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        style={styles.filter_scroll}
      />

      {/* Orders list */}
      {ordersLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={o => o.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              emoji="📋"
              title={t('orders.noOrders')}
              subtitle={t('orders.noOrdersDesc')}
              action={{
                label:   t('orders.newOrder'),
                onPress: () => router.push('/orders/create'),
              }}
            />
          }
          renderItem={({ item: order }) => (
            <OrderCard
              order={order}
              onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })}
            />
          )}
        />
      )}
    </View>
  )
}

const OrderCard = React.memo(function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const { t } = useTranslation()

  return (
    <TouchableOpacity style={styles.order_card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.order_top}>
        <View style={styles.order_id_wrap}>
          <Text style={styles.order_id}>#{order.id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.order_date}>
            {formatDate(order.createdAt, 'ar', 'relative')}
          </Text>
        </View>
        <StatusBadge status={order.status} size="sm" />
      </View>

      <Text style={styles.order_desc} numberOfLines={2}>{order.description}</Text>

      <View style={styles.order_footer}>
        <Text style={styles.order_address} numberOfLines={1}>
          📍 {order.address}
        </Text>
        {order.finalPrice != null && (
          <Text style={styles.order_price}>
            {formatPrice(order.finalPrice, order.currency ?? 'SAR', 'ar')}
          </Text>
        )}
      </View>

      {/* Quick action hint */}
      {order.status === 'quoted' && (
        <View style={styles.action_hint}>
          <Text style={styles.action_hint_text}>💬 {t('orders.quoteReceived')} — اضغط للاطلاع</Text>
        </View>
      )}
      {order.status === 'completed' && (
        <View style={[styles.action_hint, styles.action_hint_green]}>
          <Text style={[styles.action_hint_text, styles.action_hint_green_text]}>
            ✓ {t('orders.confirmDone')} — بانتظار تأكيدك
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}
)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title:   { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },
  new_btn: {},

  filter_scroll: { maxHeight: 52, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filter_bar:    { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  filter_chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, backgroundColor: Colors.gray100,
    borderWidth: 1, borderColor: Colors.border,
  },
  filter_chip_active:   { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filter_label:         { fontSize: FontSize.sm, color: Colors.gray600 },
  filter_label_active:  { color: Colors.primary, fontWeight: FontWeight.bold },

  list: { padding: Spacing.md, gap: Spacing.md },

  order_card: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  order_top:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  order_id_wrap: { gap: Spacing.xxs },
  order_id:      { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  order_date:    { fontSize: FontSize.xs, color: Colors.gray400 },
  order_desc:    { fontSize: FontSize.md, color: Colors.gray700, lineHeight: 20 },
  order_footer:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  order_address: { fontSize: FontSize.sm, color: Colors.gray500, flex: 1 },
  order_price:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },

  action_hint: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  action_hint_green:      { backgroundColor: Colors.successLight },
  action_hint_text:       { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
  action_hint_green_text: { color: Colors.success },
})
