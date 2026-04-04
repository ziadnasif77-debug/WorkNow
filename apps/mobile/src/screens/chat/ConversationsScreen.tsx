// ─────────────────────────────────────────────────────────────────────────────
// Conversations Screen — list of all active chats
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMessagingStore } from '../../stores/messagingStore'
import { useAuth } from '../../hooks/useAuth'
import { EmptyState } from '../../components/marketplace'
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme'
import { formatDate } from '@workfix/utils'
import type { Conversation } from '@workfix/types'

export default function ConversationsScreen() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const { user } = useAuth()
  const { conversations, convsLoading, subscribeConversations, unsubscribeAll } = useMessagingStore()

  useEffect(() => {
    if (user?.uid) subscribeConversations(user.uid)
    return () => unsubscribeAll()
  }, [user?.uid])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tabs.messages')}</Text>
      </View>

      {convsLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              emoji="💬"
              title={t('chat.noConversations')}
              subtitle={t('chat.noConversationsDesc')}
            />
          }
          renderItem={({ item }) => (
            <ConversationRow
              conv={item}
              myUid={user?.uid ?? ''}
              onPress={() => router.push({
                pathname: '/chat/[id]',
                params: { id: item.orderId } })}
            />
          )}
        />
      )}
    </View>
  )
}

function ConversationRow({
  conv, myUid, onPress }: {
  conv:    Conversation
  myUid:   string
  onPress: () => void
}) {
  const unread     = conv.unreadCount?.[myUid] ?? 0
  const isLastMine = conv.lastMessageSenderId === myUid
  const hasUnread  = unread > 0

  return (
    <TouchableOpacity style={styles.conv_row} onPress={onPress} activeOpacity={0.8}>
      {/* Avatar */}
      <View style={[styles.conv_avatar, hasUnread && styles.conv_avatar_active]}>
        <Text style={styles.conv_avatar_text}>
          {conv.orderId.slice(-2).toUpperCase()}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.conv_body}>
        <View style={styles.conv_top}>
          <Text style={[styles.conv_order, hasUnread && styles.conv_order_unread]}>
            {`#${conv.orderId.slice(-6).toUpperCase()}`}
          </Text>
          <Text style={styles.conv_time}>
            {formatDate(conv.lastMessageAt, 'ar', 'relative')}
          </Text>
        </View>
        <View style={styles.conv_bottom}>
          <Text
            style={[styles.conv_preview, hasUnread && styles.conv_preview_unread]}
            numberOfLines={1}
          >
            {isLastMine ? '✓ ' : ''}{conv.lastMessageText || '...'}
          </Text>
          {unread > 0 && (
            <View style={styles.unread_badge}>
              <Text style={styles.unread_text}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },
  list:  { paddingVertical: Spacing.sm },

  conv_row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border },
  conv_avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.gray100,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border },
  conv_avatar_active: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  conv_avatar_text:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray600 },

  conv_body:    { flex: 1, gap: 4 },
  conv_top:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conv_order:   { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.black },
  conv_order_unread: { fontWeight: FontWeight.bold },
  conv_time:    { fontSize: FontSize.xs, color: Colors.gray400 },

  conv_bottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conv_preview: { flex: 1, fontSize: FontSize.sm, color: Colors.gray500 },
  conv_preview_unread: { color: Colors.black, fontWeight: FontWeight.medium },

  unread_badge: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5 },
  unread_text: { color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold } })
