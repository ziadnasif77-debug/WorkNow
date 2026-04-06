// ─────────────────────────────────────────────────────────────────────────────
// Reviews + Disputes Cloud Functions
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import {
  callable, requireAuth, validate, db,
  serverTimestamp, appError, increment,
} from '../_shared/helpers'
import { rateLimit } from '../_shared/ratelimit'
import type { Order } from '@workfix/types'
import * as admin from 'firebase-admin'

// ── submitReview ──────────────────────────────────────────────────────────────

export const submitReview = callable(async (data, context) => {
  const { uid } = requireAuth(context)

  await rateLimit(uid, 'api')

  const input = validate(z.object({
    orderId:    z.string().min(1),
    targetId:   z.string().min(1),
    targetType: z.enum(['provider', 'customer']),
    rating:     z.number().int().min(1).max(5),
    comment:    z.string().max(500).optional(),
    tags:       z.array(z.string()).max(6).default([]),
  }), data)

  // Verify order exists and reviewer is a party
  const orderDoc = await db.collection('orders').doc(input.orderId).get()
  if (!orderDoc.exists) appError('ORD_001', 'Order not found', 'not-found')

  const order = orderDoc.data() as Order
  if (order.customerId !== uid && order.providerId !== uid) {
    appError('AUTH_002', 'You are not a party to this order', 'permission-denied')
  }
  if (!['closed', 'completed'].includes(order.status)) {
    appError('ORD_002', 'Can only review closed or completed orders')
  }

  // Check not already reviewed
  const existing = await db.collection('reviews')
    .where('orderId', '==', input.orderId)
    .where('reviewerId', '==', uid)
    .limit(1)
    .get()
  if (!existing.empty) appError('ORD_002', 'You have already reviewed this order')

  // Get reviewer name
  const userDoc  = await db.collection('users').doc(uid).get()
  const userData = userDoc.data()!

  // Write review
  const reviewRef = db.collection('reviews').doc()
  await reviewRef.set({
    id:               reviewRef.id,
    orderId:          input.orderId,
    reviewerId:       uid,
    reviewerName:     userData['displayName'] as string,
    reviewerAvatarUrl: userData['avatarUrl'] as string | undefined,
    targetId:         input.targetId,
    targetType:       input.targetType,
    rating:           input.rating,
    comment:          input.comment,
    tags:             input.tags,
    createdAt:        serverTimestamp(),
  })

  // Update provider's avgRating atomically
  if (input.targetType === 'provider') {
    const profileRef = db.collection('providerProfiles').doc(input.targetId)
    await db.runTransaction(async tx => {
      const profileDoc = await tx.get(profileRef)
      if (!profileDoc.exists) return

      const profile       = profileDoc.data()!
      const currentTotal  = (profile['avgRating'] as number) * (profile['totalReviews'] as number)
      const newCount      = (profile['totalReviews'] as number) + 1
      const newAvg        = (currentTotal + input.rating) / newCount

      tx.update(profileRef, {
        avgRating:    Math.round(newAvg * 10) / 10,
        totalReviews: newCount,
        updatedAt:    serverTimestamp(),
      })
    })
  }

  return { ok: true, reviewId: reviewRef.id }
})

// ── openDispute ───────────────────────────────────────────────────────────────

export const openDispute = callable(async (data, context) => {
  const { uid } = requireAuth(context)

  await rateLimit(uid, 'api')

  const input = validate(z.object({
    orderId:      z.string().min(1),
    reason:       z.string().min(1),
    description:  z.string().min(20).max(1000),
    evidenceUrls: z.array(z.string().url()).max(5).default([]),
  }), data)

  const orderDoc = await db.collection('orders').doc(input.orderId).get()
  if (!orderDoc.exists) appError('ORD_001', 'Order not found', 'not-found')

  const order = orderDoc.data() as Order
  if (order.customerId !== uid && order.providerId !== uid) {
    appError('AUTH_002', 'You are not a party to this order', 'permission-denied')
  }
  if (!['completed', 'closed', 'in_progress'].includes(order.status)) {
    appError('ORD_002', 'Cannot open dispute for this order status')
  }

  // Check no existing open dispute
  const existingDispute = await db.collection('disputes')
    .where('orderId', '==', input.orderId)
    .where('status', 'in', ['open', 'under_review'])
    .limit(1)
    .get()
  if (!existingDispute.empty) appError('ORD_002', 'An active dispute already exists for this order')

  const respondentId = order.customerId === uid ? order.providerId! : order.customerId

  const disputeRef = db.collection('disputes').doc()
  await disputeRef.set({
    id:            disputeRef.id,
    orderId:       input.orderId,
    initiatorId:   uid,
    initiatorRole: order.customerId === uid ? 'customer' : 'provider',
    respondentId,
    reason:        input.reason,
    description:   input.description,
    evidenceUrls:  input.evidenceUrls,
    status:        'open',
    createdAt:     serverTimestamp(),
    updatedAt:     serverTimestamp(),
  })

  // Update order status + freeze escrow to prevent auto-release
  await db.collection('orders').doc(input.orderId).update({
    status:        'disputed',
    escrowFrozen:  true,      // blocks scheduled release_escrow task
    updatedAt:     serverTimestamp(),
  })

  // Create admin review task
  await db.collection('adminTasks').add({
    type:       'dispute_review',
    disputeId:  disputeRef.id,
    orderId:    input.orderId,
    initiatorId: uid,
    respondentId,
    priority:   'high',
    status:     'pending',
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp(),
    expiresAt:  new Date(Date.now() + 48 * 3600_000), // 48h SLA
  })

  // Notify all admins
  const adminsSnap = await db.collection('users')
    .where('role', 'in', ['admin', 'superadmin'])
    .get()

  await Promise.allSettled(
    adminsSnap.docs.map(adminDoc =>
      db.collection('users').doc(adminDoc.id).collection('notifications').add({
        userId:    adminDoc.id,
        title:     { ar: 'نزاع جديد يحتاج مراجعة', en: 'New dispute requires review' },
        body:      { ar: `نزاع على الطلب ${input.orderId.slice(-6)} — يُرجى المراجعة خلال 48 ساعة`, en: `Dispute on order ${input.orderId.slice(-6)} — review within 48h` },
        type:      'dispute_review',
        refId:     disputeRef.id,
        isRead:    false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
    ),
  )

  return { ok: true, disputeId: disputeRef.id }
})
