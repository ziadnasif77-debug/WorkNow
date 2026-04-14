// ─────────────────────────────────────────────────────────────────────────────
// Notifications Screen — in-app notification center
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useNotificationsStore } from '../../stores/notificationsStore'
import { EmptyState } from '../../components/marketplace'
import { LoadingState } from '../../components/ui'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, IconSize, Radius } from '../../constants/theme'
import { formatDate } from '@workfix/utils'
import type { AppNotification, NotificationType } from '@workfix/types'

// ── Notification type → emoji mapping ────────────────────────────────────────

const NOTIF_EMOJI: Record<NotificationType, string> = {
  new_order:           '📋',
  new_quote:           '💬',
  quote_accepted:      '✅',
  payment_held:        '🔒',
  provider_arrived:    '🔧',
  order_completed:     '🏁',
  payout_released:     '💰',
  new_message:         '✉️',
  kyc_approved:        '🎉',
  kyc_rejected:        '❌',
  dispute_opened:      '⚠️',
  dispute_resolved:    '✓',
  subscription_renewed:'🔄',
  subscription_expired:'⏰' }

const NOTIF_COLOR: Partial<Record<NotificationType, string>> = {
  kyc_approved:     Colors.success,
  kyc_rejected:     Colors.error,
  dispute_opened:   Colors.warning,
  payout_released:  Colors.success,
  payment_held:     Colors.primary }

export default function NotificationsScreen() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const {
    notifications, unreadCount, isLoading,
    markAsRead, markAllRead, getRouteForNotif } = useNotificationsStore()

  async function handlePress(notif: AppNotification) {
    try {
      await markAsRead(notif.id)
      const route = getRouteForNotif(notif)
      if (route) router.push(route as never)
    } catch (err) {
      if (__DEV__) console.warn('[Notifications] handlePress error', err)
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('notifications.title')}
        rightEl={unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} style={styles.mark_all}>
            <Text style={styles.mark_all_text}>{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        ) : undefined}
      />

      {isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              emoji="🔔"
              title={t('notifications.empty')}
              subtitle={t('notifications.emptyDesc')}
            />
          }
          renderItem={({ item: notif }) => (
            <NotificationRow notif={notif} onPress={() => handlePress(notif)} />
          )}
        />
      )}
    </View>
  )
}

function NotificationRow({
  notif, onPress }: {
  notif:   AppNotification
  onPress: () => void
}) {
  const { i18n } = useTranslation()
  const lang     = (i18n.language === 'ar' ? 'ar' : 'en') as 'ar' | 'en'
  const emoji    = NOTIF_EMOJI[notif.type] ?? '🔔'
  const accentColor = NOTIF_COLOR[notif.type] ?? Colors.primary

  return (
    <TouchableOpacity
      style={[styles.row, !notif.isRead && styles.row_unread]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Unread dot */}
      {!notif.isRead && <View style={styles.unread_dot} />}

      {/* Icon */}
      <View style={[styles.icon_wrap, { backgroundColor: `${accentColor}18` }]}>
        <Text style={styles.icon}>{emoji}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.notif_title, !notif.isRead && styles.notif_title_unread]}>
          {notif.title[lang] || notif.title.ar}
        </Text>
        <Text style={styles.notif_body} numberOfLines={2}>
          {notif.body[lang] || notif.body.ar}
        </Text>
        <Text style={styles.notif_time}>
          {formatDate(notif.createdAt, lang, 'relative')}
        </Text>
      </View>

      {/* Chevron if tappable */}
      {notif.refId && (
        <Text style={styles.chevron}>›</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  mark_all:      { paddingHorizontal: Spacing.sm },
  mark_all_text: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    position: 'relative' },
  row_unread: { backgroundColor: Colors.primaryLight + '40' },

  unread_dot: {
    position: 'absolute', top: Spacing.md, start: 6,
    width: 8, height: 8, borderRadius: Radius.full,
    backgroundColor: Colors.primary },

  icon_wrap: {
    width: 46, height: 46, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon: { fontSize: IconSize.md },

  content:            { flex: 1, gap: 3 },
  notif_title:        { fontSize: FontSize.md, color: Colors.black, fontWeight: FontWeight.medium },
  notif_title_unread: { fontWeight: FontWeight.bold },
  notif_body:         { fontSize: FontSize.sm, color: Colors.gray600, lineHeight: 18 },
  notif_time:         { fontSize: FontSize.xs, color: Colors.gray400 },

  chevron: { fontSize: IconSize.md, color: Colors.gray300 } })
