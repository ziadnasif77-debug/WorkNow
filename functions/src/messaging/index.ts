// ─────────────────────────────────────────────────────────────────────────────
// Messaging Functions
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import { callable, requireAuth, validate, db, serverTimestamp, appError } from '../_shared/helpers'
import { rateLimit } from '../_shared/ratelimit'
import type { Conversation, Message } from '@workfix/types'

const getOrCreateConversationSchema = z.object({
  orderId: z.string().min(1),
})

export const getOrCreateConversation = callable(async (data, context) => {
  const { uid } = requireAuth(context)
  const input = validate(getOrCreateConversationSchema, data)

  // Check if conversation exists for this order
  const existing = await db
    .collection('conversations')
    .where('orderId', '==', input.orderId)
    .limit(1)
    .get()

  if (!existing.empty) {
    return { ok: true, conversationId: existing.docs[0]!.id }
  }

  const orderDoc = await db.collection('orders').doc(input.orderId).get()
  if (!orderDoc.exists) appError('ORD_001', 'Order not found', 'not-found')

  const order = orderDoc.data()!
  if (!order['providerId']) {
    appError('ORD_002', 'Cannot start chat before a provider is assigned')
  }

  // Only the order parties can create a conversation
  if (uid !== order['customerId'] && uid !== order['providerId']) {
    appError('AUTH_002', 'You are not a party to this order', 'permission-denied')
  }

  const convRef = db.collection('conversations').doc()
  const conv: Omit<Conversation, 'id'> = {
    orderId:             input.orderId,
    customerId:          order['customerId'] as string,
    providerId:          order['providerId'] as string,
    lastMessageAt:       serverTimestamp() as unknown as import('@workfix/types').Timestamp,
    lastMessageText:     '',
    lastMessageSenderId: uid,
    unreadCount:         {},
    typingStatus:        {},        // legacy — kept for migration
    typingExpiresAt:     {},        // TTL-based typing indicator (v2)
    createdAt:           serverTimestamp() as unknown as import('@workfix/types').Timestamp,
  }

  await convRef.set({ ...conv, id: convRef.id })
  return { ok: true, conversationId: convRef.id }
})

const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  text:           z.string().max(2000).optional(),
  mediaUrl:       z.string().url().optional(),
  mediaType:      z.enum(['image', 'document']).optional(),
}).refine(d => d.text || d.mediaUrl, {
  message: 'Message must have text or media',
})

export const sendMessage = callable(async (data, context) => {
  const { uid } = requireAuth(context)
  await rateLimit(uid, 'api')
  const input = validate(sendMessageSchema, data)

  const convDoc = await db.collection('conversations').doc(input.conversationId).get()
  if (!convDoc.exists) appError('GEN_004', 'Conversation not found', 'not-found')

  const conv = convDoc.data() as Conversation
  if (uid !== conv.customerId && uid !== conv.providerId) {
    appError('AUTH_002', 'You are not a party to this conversation', 'permission-denied')
  }

  const userDoc = await db.collection('users').doc(uid).get()
  const userData = userDoc.data()!

  const msgRef = db
    .collection('conversations')
    .doc(input.conversationId)
    .collection('messages')
    .doc()

  const msg: Omit<Message, 'id'> = {
    conversationId: input.conversationId,
    senderId:       uid,
    senderName:     userData['displayName'] as string,
    ...(userData['avatarUrl'] !== undefined && { senderAvatarUrl: userData['avatarUrl'] as string }),
    ...(input.text !== undefined && { text: input.text }),
    ...(input.mediaUrl !== undefined && { mediaUrl: input.mediaUrl }),
    ...(input.mediaType !== undefined && { mediaType: input.mediaType }),
    isRead:         false,
    sentAt:         serverTimestamp() as unknown as import('@workfix/types').Timestamp,
  }

  await msgRef.set({ ...msg, id: msgRef.id })
  return { ok: true, messageId: msgRef.id }
})

const markReadSchema = z.object({
  conversationId: z.string().min(1),
})

export const markRead = callable(async (data, context) => {
  const { uid } = requireAuth(context)
  const input = validate(markReadSchema, data)

  const convRef = db.collection('conversations').doc(input.conversationId)
  await convRef.update({
    [`unreadCount.${uid}`]: 0,
    updatedAt: serverTimestamp(),
  })

  // Mark all unread messages as read in a batch
  const unread = await convRef
    .collection('messages')
    .where('senderId', '!=', uid)
    .where('isRead', '==', false)
    .get()

  if (unread.empty) return { ok: true }

  const batch = db.batch()
  unread.docs.forEach(doc => {
    batch.update(doc.ref, { isRead: true, readAt: serverTimestamp() })
  })
  await batch.commit()

  return { ok: true, markedCount: unread.size }
})
