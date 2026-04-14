// ─────────────────────────────────────────────────────────────────────────────
// Chat Screen — realtime messaging with typing indicator + read receipts
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Image, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
  ActionSheetIOS,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMessagingStore } from '../../stores/messagingStore'
import { useAuth } from '../../hooks/useAuth'
import { useImageUpload } from '../../hooks/useImageUpload'
import { ScreenHeader } from '../../components/ScreenHeader'
import { LoadingState } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize, AvatarSize } from '../../constants/theme'
import { formatDate } from '@workfix/utils'
import type { Message } from '@workfix/types'

export default function ChatScreen() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const { id: orderId } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const myUid    = user?.uid ?? ''

  const {
    messages, messagesLoading, typingUsers,
    sendLoading, sendError,
    openConversation, subscribeMessages,
    sendMessage, sendTyping, markRead,
    unsubscribeAll, clearError,
  } = useMessagingStore()

  const { pickAndUpload, captureAndUpload, isUploading } = useImageUpload('messages')

  const [text,      setText]      = useState('')
  const [convId,    setConvId]    = useState<string | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const flatRef   = useRef<FlatList>(null)
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Init: open / create conversation ────────────────────────────────────
  useEffect(() => {
    if (!orderId) return

    void (async () => {
      try {
        const cId = await openConversation(orderId)
        setConvId(cId)
        subscribeMessages(cId, myUid)
      } catch {
        setInitError('تعذّر فتح المحادثة')
      }
    })()

    return () => unsubscribeAll()
  }, [orderId, myUid])

  // ── Auto-scroll to bottom on new messages ────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length])

  // ── Typing handler ────────────────────────────────────────────────────────
  function handleTextChange(val: string) {
    setText(val)
    if (!convId) return

    void sendTyping(convId, myUid, val.length > 0)

    // Clear typing after 2s idle
    if (typingRef.current) clearTimeout(typingRef.current)
    if (val.length > 0) {
      typingRef.current = setTimeout(() => {
        void sendTyping(convId, myUid, false)
      }, 2000)
    }
  }

  // ── Send text ─────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!convId || text.trim().length === 0 || sendLoading) return
    const msg = text.trim()
    setText('')
    void sendTyping(convId, myUid, false)
    await sendMessage(convId, msg)
  }

  // ── Attach image ─────────────────────────────────────────────────────────
  function handleAttach() {
    if (!convId) return

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('chat.choosePhoto'), t('chat.takePhoto'), t('common.cancel')],
          cancelButtonIndex: 2,
        },
        async idx => {
          if (idx === 0) await uploadAndSend('library')
          if (idx === 1) await uploadAndSend('camera')
        },
      )
    } else {
      Alert.alert(t('chat.attachImage'), '', [
        { text: t('chat.choosePhoto'), onPress: () => void uploadAndSend('library') },
        { text: t('chat.takePhoto'),   onPress: () => void uploadAndSend('camera') },
        { text: t('common.cancel'), style: 'cancel' },
      ])
    }
  }

  async function uploadAndSend(source: 'library' | 'camera') {
    if (!convId) return
    try {
      const url = source === 'library'
        ? await pickAndUpload()
        : await captureAndUpload()
      if (url) await sendMessage(convId, undefined, url, 'image')
    } catch (err) {
      console.warn('[Chat] Upload failed', err)
    }
  }

  const isTyping = Object.values(typingUsers).some(Boolean)

  if (initError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error_text}>{initError}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back_link}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <ScreenHeader
        title={`${t('chat.title')} #${orderId?.slice(-6).toUpperCase() ?? ''}`}
        rightEl={
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/orders/[id]', params: { id: orderId } })}
            style={styles.order_btn}
          >
            <Text style={styles.order_btn_icon}>📋</Text>
          </TouchableOpacity>
        }
      />

      {/* ── Messages ───────────────────────────────────────────────────── */}
      {messagesLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={item => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          contentContainerStyle={styles.messages_content}
          showsVerticalScrollIndicator={false}
          onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty_chat}>
              <Text style={styles.empty_emoji}>💬</Text>
              <Text style={styles.empty_text}>{t('chat.startConversation')}</Text>
            </View>
          }
          renderItem={({ item: msg, index }) => {
            const isMine     = msg.senderId === myUid
            const prevMsg    = index > 0 ? messages[index - 1] : null
            const showDate   = !prevMsg || isDifferentDay(prevMsg.sentAt, msg.sentAt)
            const showAvatar = !isMine && (!prevMsg || prevMsg.senderId !== msg.senderId)

            return (
              <View>
                {showDate && (
                  <View style={styles.date_separator}>
                    <View style={styles.date_line} />
                    <Text style={styles.date_label}>
                      {formatDate(msg.sentAt, 'ar', 'date')}
                    </Text>
                    <View style={styles.date_line} />
                  </View>
                )}
                <MessageBubble
                  message={msg}
                  isMine={isMine}
                  showAvatar={showAvatar}
                />
              </View>
            )
          }}
        />
      )}

      {/* ── Typing indicator ──────────────────────────────────────────── */}
      {isTyping && (
        <View style={styles.typing_row}>
          <View style={styles.typing_bubble}>
            <View style={styles.typing_dots}>
              <TypingDot delay={0} />
              <TypingDot delay={200} />
              <TypingDot delay={400} />
            </View>
          </View>
          <Text style={styles.typing_label}>{t('chat.typing')}</Text>
        </View>
      )}

      {/* ── Send error ────────────────────────────────────────────────── */}
      {sendError && (
        <View style={styles.send_error}>
          <Text style={styles.send_error_text}>{sendError}</Text>
          <TouchableOpacity onPress={clearError}><Text style={styles.send_error_dismiss}>✕</Text></TouchableOpacity>
        </View>
      )}

      {/* ── Input bar ─────────────────────────────────────────────────── */}
      <View style={styles.input_bar}>
        <TouchableOpacity
          style={styles.attach_btn}
          onPress={handleAttach}
          disabled={isUploading}
        >
          {isUploading
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Text style={styles.attach_icon}>📎</Text>
          }
        </TouchableOpacity>

        <TextInput
          style={styles.text_input}
          value={text}
          onChangeText={handleTextChange}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={Colors.gray400}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />

        <TouchableOpacity
          style={[styles.send_btn, (text.trim().length === 0 || sendLoading) && styles.send_btn_disabled]}
          onPress={handleSend}
          disabled={text.trim().length === 0 || sendLoading}
        >
          {sendLoading
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Text style={styles.send_icon}>➤</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Bubble
// ─────────────────────────────────────────────────────────────────────────────

function MessageBubble({
  message, isMine, showAvatar,
}: {
  message:    Message
  isMine:     boolean
  showAvatar: boolean
}) {
  const isImage = message.mediaType === 'image' && message.mediaUrl

  return (
    <View style={[styles.bubble_row, isMine && styles.bubble_row_mine]}>
      {/* Avatar (other user only) */}
      {!isMine && (
        <View style={[styles.bubble_avatar, !showAvatar && styles.bubble_avatar_hidden]}>
          {showAvatar && (
            <View style={styles.avatar_circle}>
              <Text style={styles.avatar_letter}>
                {(message.senderName ?? '?')[0]?.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={[styles.bubble_wrap, isMine && styles.bubble_wrap_mine]}>
        {/* Sender name (first message in group) */}
        {!isMine && showAvatar && (
          <Text style={styles.bubble_sender}>{message.senderName}</Text>
        )}

        {/* Content */}
        <View style={[styles.bubble, isMine ? styles.bubble_mine : styles.bubble_other]}>
          {isImage ? (
            <Image
              source={{ uri: message.mediaUrl }}
              style={styles.bubble_image}
              resizeMode="cover"
            />
          ) : (
            <Text style={[styles.bubble_text, isMine && styles.bubble_text_mine]}>
              {message.text}
            </Text>
          )}
        </View>

        {/* Time + read receipt */}
        <View style={[styles.bubble_meta, isMine && styles.bubble_meta_mine]}>
          <Text style={styles.bubble_time}>
            {formatDate(message.sentAt, 'ar', 'time')}
          </Text>
          {isMine && (
            <Text style={[styles.read_receipt, message.isRead && styles.read_receipt_read]}>
              {message.isRead ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}

// ── Animated typing dot ───────────────────────────────────────────────────────

import { Animated } from 'react-native'

function TypingDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0,  duration: 300, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [])

  return (
    <Animated.View style={[styles.dot, { transform: [{ translateY: anim }] }]} />
  )
}

// ── Date helper ───────────────────────────────────────────────────────────────

function isDifferentDay(
  a: { seconds?: number } | Date,
  b: { seconds?: number } | Date,
): boolean {
  const toDate = (t: unknown) => {
    if (t instanceof Date) return t
    const secs = (t as { seconds?: number })?.seconds
    return secs ? new Date(secs * 1000) : new Date()
  }
  const da = toDate(a)
  const db = toDate(b)
  return da.toDateString() !== db.toDateString()
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },

  // Header
  order_btn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  order_btn_icon: { fontSize: IconSize.md },

  // Messages
  messages_content: { padding: Spacing.md, gap: Spacing.xxs, paddingBottom: Spacing.lg },
  empty_chat:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  empty_emoji: { fontSize: IconSize.xxl },
  empty_text:  { fontSize: FontSize.md, color: Colors.gray400, textAlign: 'center' },

  // Date separator
  date_separator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.md },
  date_line:      { flex: 1, height: 1, backgroundColor: Colors.border },
  date_label:     { fontSize: FontSize.xs, color: Colors.gray400, paddingHorizontal: Spacing.sm },

  // Bubble
  bubble_row:      { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginBottom: 3 },
  bubble_row_mine: { flexDirection: 'row-reverse' },
  bubble_avatar:        { width: 28 },
  bubble_avatar_hidden: { width: 28 },
  avatar_circle: {
    width: AvatarSize.xs, height: AvatarSize.xs, borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar_letter: { fontSize: IconSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },

  bubble_wrap:      { maxWidth: '75%', gap: 3 },
  bubble_wrap_mine: {},
  bubble_sender:    { fontSize: FontSize.xs, color: Colors.gray500, paddingStart: 4 },

  bubble: {
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomStartRadius: 4,
  },
  bubble_mine:  {
    backgroundColor: Colors.primary,
    borderBottomStartRadius: Radius.lg,
    borderBottomEndRadius: 4,
  },
  bubble_other: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },

  bubble_text:      { fontSize: FontSize.md, color: Colors.black, lineHeight: 22 },
  bubble_text_mine: { color: Colors.white },
  bubble_image:     { width: 200, height: 200, borderRadius: Radius.md },

  bubble_meta:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingStart: Spacing.xs },
  bubble_meta_mine: { flexDirection: 'row-reverse', paddingStart: 0, paddingEnd: 4 },
  bubble_time:      { fontSize: 10, color: Colors.gray400 },
  read_receipt:     { fontSize: 11, color: Colors.gray300 },
  read_receipt_read: { color: Colors.primary },

  // Typing
  typing_row:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  typing_bubble: {
    backgroundColor: Colors.white, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  typing_dots:  { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gray400 },
  typing_label: { fontSize: FontSize.xs, color: Colors.gray400 },

  // Send error
  send_error: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.errorLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  send_error_text:    { flex: 1, fontSize: FontSize.sm, color: Colors.error },
  send_error_dismiss: { fontSize: IconSize.sm, color: Colors.error },

  // Input bar
  input_bar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  attach_btn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  attach_icon: { fontSize: IconSize.md },
  text_input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: Colors.gray100, borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.black,
  },
  send_btn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  send_btn_disabled: { backgroundColor: Colors.gray200 },
  send_icon:         { fontSize: IconSize.sm, color: Colors.white },

  // Error state
  error_text: { fontSize: FontSize.md, color: Colors.error, textAlign: 'center' },
  back_link:  { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.bold },
})
