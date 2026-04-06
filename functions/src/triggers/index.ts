// ─────────────────────────────────────────────────────────────────────────────
// Firestore Triggers — react to data changes automatically
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { db, serverTimestamp, messaging } from '../_shared/helpers'
import { logger, auditLog } from '../_shared/monitoring'
import { enqueue } from '../_shared/queue'
import { releaseEscrowById, refundEscrowById } from '../payments/escrow'
import type { Order, Message, Conversation } from '@workfix/types'
import { ESCROW_AUTO_RELEASE_HOURS } from '@workfix/config'

// ── onOrderStatusChanged ──────────────────────────────────────────────────────

export const onOrderStatusChanged = functions
  .region('me-central1')
  .firestore.document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as Order
    const after  = change.after.data() as Order

    if (before.status === after.status) return  // no status change

    const orderId = context.params['orderId'] as string
    functions.logger.info('Order status changed', {
      orderId,
      from: before.status,
      to:   after.status,
    })

    // ── Send FCM to the other party ──────────────────────────────────────────
    const notifications: Array<{ userId: string; title: string; body: string; refId: string; refType: 'order' | 'message' | 'dispute' | 'payment' }> = []

    switch (after.status) {
      case 'quoted':
        notifications.push({
          userId: after.customerId,
          title:  'عرض سعر جديد',
          body:   'تلقّيت عرض سعر على طلبك. اضغط للاطلاع.',
          refId:  orderId, refType: 'order',
        })
        break

      case 'confirmed':
        if (after.providerId) {
          notifications.push({
            userId: after.providerId,
            title:  'تم قبول عرضك!',
            body:   `وافق العميل على عرضك وأتمّ الدفع. الطلب رقم ${orderId.slice(-6)}`,
            refId:  orderId, refType: 'order',
          })
        }
        break

      case 'in_progress':
        notifications.push({
          userId: after.customerId,
          title:  'المزوّد في الطريق',
          body:   'أكّد مزوّد الخدمة وصوله وبدأ العمل.',
          refId:  orderId, refType: 'order',
        })
        break

      case 'completed':
        notifications.push({
          userId: after.customerId,
          title:  'تم إنجاز الخدمة',
          body:   'أكّد المزوّد إتمام الخدمة. يرجى التحقق والموافقة.',
          refId:  orderId, refType: 'order',
        })
        break

      case 'closed':
        // Release Escrow via dedicated escrow module (with retry + audit log)
        if (after.providerId) {
          notifications.push({
            userId: after.providerId,
            title:  'تم تحرير المبلغ',
            body:   `تم تحويل ${after.netAmount?.toFixed(2) ?? ''} إلى محفظتك.`,
            refId:  orderId, refType: 'order',
          })
        }
        await releaseEscrowById(after.id).catch(err =>
          logger.error('Escrow release failed in trigger', err, { orderId }),
        )
        // Update provider stats via queue (non-blocking)
        if (after.providerId) {
          await enqueue('update_provider_stats', { providerId: after.providerId })
          await db.collection('providerProfiles').doc(after.providerId).update({
            totalCompletedOrders: admin.firestore.FieldValue.increment(1),
            updatedAt: serverTimestamp(),
          })
        }
        await auditLog('order_closed', after.providerId ?? 'system', {
          orderId, amount: after.finalPrice, netAmount: after.netAmount,
        })
        break

      case 'cancelled':
        // Refund via dedicated escrow module (with retry + audit log)
        if (after.paymentStatus === 'held' && after.escrowPaymentId) {
          await refundEscrowById(after.id, after.cancelReason ?? 'cancelled')
            .catch(err => logger.error('Escrow refund failed in trigger', err, { orderId }))
        }
        // Notify both parties
        notifications.push({
          userId: after.customerId,
          title:  'تم إلغاء الطلب',
          body:   after.cancelReason ?? 'تم إلغاء طلبك.',
          refId:  orderId, refType: 'order',
        })
        if (after.providerId) {
          notifications.push({
            userId: after.providerId,
            title:  'تم إلغاء الطلب',
            body:   'تم إلغاء الطلب من قِبَل أحد الأطراف.',
            refId:  orderId, refType: 'order',
          })
        }
        break

      case 'disputed':
        notifications.push({
          userId: after.customerId,
          title:  'نزاع مفتوح',
          body:   'تم فتح نزاع على طلبك. سيتواصل معك فريق الدعم.',
          refId:  orderId, refType: 'dispute',
        })
        if (after.providerId) {
          notifications.push({
            userId: after.providerId,
            title:  'نزاع مفتوح',
            body:   'تم فتح نزاع على الطلب. سيتواصل معك فريق الدعم.',
            refId:  orderId, refType: 'dispute',
          })
        }
        break
    }

    // Send all notifications
    await Promise.allSettled(notifications.map(n => sendPushAndStore(n)))
  })

// ── onQuoteCreated ────────────────────────────────────────────────────────────

export const onQuoteCreated = functions
  .region('me-central1')
  .firestore.document('orders/{orderId}/quotes/{quoteId}')
  .onCreate(async (_snap, context) => {
    const orderId = context.params['orderId'] as string

    const orderDoc = await db.collection('orders').doc(orderId).get()
    if (!orderDoc.exists) return

    const order = orderDoc.data() as Order

    await sendPushAndStore({
      userId:    order.customerId,
      title:     'عرض سعر جديد',
      body:      'لديك عرض سعر جديد على طلبك. اضغط للاطلاع.',
      notifType: 'orderUpdates',
      refId:     orderId,
      refType:   'order',
    })
  })

// ── onOrderCreated ────────────────────────────────────────────────────────────
// Notify providers who offer services in the same category when a new order is posted.

export const onOrderCreated = functions
  .region('me-central1')
  .firestore.document('orders/{orderId}')
  .onCreate(async (snap, context) => {
    const order   = snap.data() as Order
    const orderId = context.params['orderId'] as string

    // Only notify for orders that start in pending status
    if (order.status !== 'pending') return

    // Guard: categoryId must be present for the query to work
    if (!order.categoryId) {
      functions.logger.warn('onOrderCreated: order has no categoryId, skipping provider notifications', { orderId })
      return
    }

    functions.logger.info('New order created — notifying nearby providers', { orderId })

    // Query providers who have the matching category in their service list
    const providersSnap = await db.collection('providerProfiles')
      .where('categoryIds', 'array-contains', order.categoryId)
      .where('isActive', '==', true)
      .where('kycStatus', '==', 'approved')
      .limit(50)
      .get()

    if (providersSnap.empty) {
      functions.logger.info('No matching providers found for new order', { orderId, categoryId: order.categoryId })
      return
    }

    await Promise.allSettled(
      providersSnap.docs.map(doc =>
        sendPushAndStore({
          userId:    doc.id,
          title:     'طلب جديد بالقرب منك',
          body:      `طلب خدمة جديد في فئتك. اضغط لعرض التفاصيل وإرسال عرض سعر.`,
          notifType: 'newOrder' as const,
          refId:     orderId,
          refType:   'order',
        }),
      ),
    )

    functions.logger.info('Provider notifications sent for new order', {
      orderId,
      providerCount: providersSnap.size,
    })
  })

// ── onPaymentCaptured ─────────────────────────────────────────────────────────

export const onPaymentCaptured = functions
  .region('me-central1')
  .firestore.document('payments/{paymentId}')
  .onUpdate(async (change, _context) => {
    const before = change.before.data()
    const after  = change.after.data()

    if (before['status'] !== 'initiated' || after['status'] !== 'held') return

    const orderId    = after['orderId'] as string
    const providerId = after['providerId'] as string

    await sendPushAndStore({
      userId:    providerId,
      title:     'تم استلام الدفع',
      body:      'أتمّ العميل الدفع وهو محتجز بأمان حتى إتمام الخدمة.',
      notifType: 'orderUpdates',
      refId:     orderId,
      refType:   'payment',
    })

    // Schedule auto-release via task queue (48h delay)
    await enqueue(
      'release_escrow',
      { orderId },
      { delayMs: ESCROW_AUTO_RELEASE_HOURS * 3600_000 },
    )

    logger.info('Escrow hold confirmed + auto-release scheduled', {
      orderId, providerId, delayHours: ESCROW_AUTO_RELEASE_HOURS,
    })
  })

// ── onMessageCreated ──────────────────────────────────────────────────────────

export const onMessageCreated = functions
  .region('me-central1')
  .firestore.document('conversations/{convId}/messages/{msgId}')
  .onCreate(async (snap, context) => {
    const msg = snap.data() as Message
    const convId = context.params['convId'] as string

    // Update conversation metadata
    const convRef = db.collection('conversations').doc(convId)
    const convDoc = await convRef.get()
    if (!convDoc.exists) return

    const conv = convDoc.data() as Conversation
    const recipientId = msg.senderId === conv.customerId
      ? conv.providerId
      : conv.customerId

    await convRef.update({
      lastMessageAt:     serverTimestamp(),
      lastMessageText:   msg.text ?? '📎 مرفق',
      lastMessageSenderId: msg.senderId,
      [`unreadCount.${recipientId}`]: admin.firestore.FieldValue.increment(1),
      updatedAt: serverTimestamp(),
    })

    // Push notification for new message
    await sendPushAndStore({
      userId:    recipientId,
      title:     msg.senderName,
      body:      msg.text ?? 'أرسل لك مرفقاً',
      notifType: 'newMessage',
      refId:     convId,
      refType:   'message',
    })
  })

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type NotifType = 'newOrder' | 'newMessage' | 'orderUpdates' | 'promotions'

async function sendPushAndStore({
  userId,
  title,
  body,
  notifType = 'orderUpdates',
  refId,
  refType,
}: {
  userId: string
  title: string
  body: string
  notifType?: NotifType
  refId?: string
  refType?: 'order' | 'message' | 'dispute' | 'payment'
}): Promise<void> {
  // Get user doc (FCM tokens + notification preferences)
  const userDoc = await db.collection('users').doc(userId).get()
  const userData = userDoc.data()
  const tokens = (userData?.['fcmTokens'] as string[] | undefined) ?? []

  // Respect notification preferences — default to sending if prefs not set
  const prefs = userData?.['notificationPrefs'] as Record<string, boolean> | undefined
  if (prefs && prefs[notifType] === false) return

  // Store in-app notification (always, even when FCM is opted out)
  await db.collection('users').doc(userId).collection('notifications').add({
    userId,
    title:     { ar: title, en: title },
    body:      { ar: body, en: body },
    type:      notifType,
    isRead:    false,
    createdAt: serverTimestamp(),
  })

  if (tokens.length === 0) return

  // Send FCM
  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: {
      ...(refId    && { refId }),
      ...(refType  && { refType }),
      type: notifType,
    },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  })

  // Clean up invalid tokens
  const invalidTokens: string[] = []
  result.responses.forEach((resp, idx) => {
    if (!resp.success && tokens[idx]) {
      invalidTokens.push(tokens[idx]!)
    }
  })

  if (invalidTokens.length > 0) {
    await db.collection('users').doc(userId).update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
    })
  }
}
