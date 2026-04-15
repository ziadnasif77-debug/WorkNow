// ─────────────────────────────────────────────────────────────────────────────
// Reviews + Disputes Cloud Functions
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import {
  callable, requireAuth, validate, db,
  appError,
} from '../_shared/helpers'
import { rateLimit } from '../_shared/ratelimit'
import { logger, updateFraudScore } from '../_shared/monitoring'
import type { Order } from '@workfix/types'

// ── submitReview ──────────────────────────────────────────────────────────────

export const submitReview = callable(async (data, context) => {
  const { uid, role } = requireAuth(context)

  // Dedicated rate limit: max 10 reviews per day per user
  await rateLimit(uid, 'review')

  // Flagged account check — block before any further processing
  const userDoc = await db.collection('users').doc(uid).get()
  if (!userDoc.exists) {
    appError('AUTH_001', 'Reviewer user record not found', 'not-found')
  }
  const userData = userDoc.data()!
  if (userData['isFlagged'] === true) {
    logger.security('review_flagged_user_blocked', { uid })
    appError('AUTH_002', 'Your account is restricted from submitting reviews', 'permission-denied')
  }

  const input = validate(z.object({
    orderId:        z.string().trim().min(1).max(128),
    targetId:       z.string().trim().min(1).max(128),
    targetType:     z.enum(['provider', 'customer']),
    rating:         z.number().int().min(1).max(5),
    comment:        z.string().trim().max(500).optional(),
    tags:           z.array(z.string().trim().min(1).max(50)).max(6).default([]),
    idempotencyKey: z.string().trim().min(1).max(64).optional(),
  }), data)

  // ── Role-based targetType enforcement ──────────────────────────────────────
  if (role === 'customer' && input.targetType !== 'provider') {
    logger.security('review_role_targettype_mismatch', { uid, role, targetType: input.targetType })
    appError('AUTH_002', 'Customers can only review providers', 'permission-denied')
  }
  if (role === 'provider' && input.targetType !== 'customer') {
    logger.security('review_role_targettype_mismatch', { uid, role, targetType: input.targetType })
    appError('AUTH_002', 'Providers can only review customers', 'permission-denied')
  }

  // Reviewer cannot review themselves
  if (input.targetId === uid) {
    logger.security('review_self_attempt', { uid, orderId: input.orderId })
    void updateFraudScore(uid, 20, 'self_review')
    appError('AUTH_002', 'Cannot review yourself', 'permission-denied')
  }

  // ── Idempotency: safe retry — return cached result for duplicate requests ────
  if (input.idempotencyKey) {
    const keyDocId = `review_${input.idempotencyKey}_${uid}`
    const keySnap  = await db.collection('_idempotencyKeys').doc(keyDocId).get()
    if (keySnap.exists) {
      const cached = keySnap.data()!
      if (cached['uid'] !== uid) {
        logger.security('idempotency_key_uid_mismatch', { uid, idempotencyKey: input.idempotencyKey })
        appError('AUTH_002', 'Idempotency key does not match caller', 'permission-denied')
      }
      logger.info('review_idempotent_return', { uid, idempotencyKey: input.idempotencyKey })
      return cached['result'] as { ok: boolean; reviewId: string }
    }
  }

  // Verify order exists and caller is a party
  const orderDoc = await db.collection('orders').doc(input.orderId).get()
  if (!orderDoc.exists) {
    logger.warn('review_order_not_found', { uid, orderId: input.orderId })
    appError('ORD_001', 'Order not found', 'not-found')
  }

  const order = orderDoc.data() as Order
  if (order.customerId !== uid && order.providerId !== uid) {
    logger.security('review_not_party', {
      uid,
      orderId:    input.orderId,
      customerId: order.customerId,
      providerId: order.providerId,
    })
    void updateFraudScore(uid, 10, 'not_party')
    appError('AUTH_002', 'You are not a party to this order', 'permission-denied')
  }

  if (!['closed', 'completed'].includes(order.status)) {
    logger.warn('review_invalid_order_status', {
      uid,
      orderId: input.orderId,
      status:  order.status,
    })
    appError('ORD_002', 'Can only review closed or completed orders')
  }

  // Verify targetId is the actual order counterparty
  const expectedTargetId = order.customerId === uid ? order.providerId : order.customerId
  if (input.targetId !== expectedTargetId) {
    logger.security('review_invalid_target', {
      uid,
      orderId:          input.orderId,
      suppliedTargetId: input.targetId,
      expectedTargetId,
    })
    void updateFraudScore(uid, 10, 'invalid_target')
    appError('AUTH_002', 'Target does not match the order counterparty', 'permission-denied')
  }

  // ── Daily per-target limit: max 1 review per target per 24 hours ─────────────
  const oneDayAgo = new Date(Date.now() - 24 * 3600_000)
  const recentSnap = await db.collection('reviews')
    .where('reviewerId', '==', uid)
    .where('targetId',   '==', input.targetId)
    .where('createdAt',  '>=', oneDayAgo)
    .limit(1)
    .get()

  if (!recentSnap.empty) {
    logger.security('review_daily_limit_exceeded', { uid, targetId: input.targetId })
    void updateFraudScore(uid, 5, 'daily_review_limit')
    appError('ORD_003', 'You can only submit one review per target per 24 hours')
  }

  // ── Atomic transaction: duplicate check + review write + rating update ────────
  // Deterministic doc ID eliminates TOCTOU: two concurrent calls for the same
  // (orderId, uid) pair collide on the same document ID — only one tx commits.
  const reviewId  = `${input.orderId}_${uid}`
  const reviewRef = db.collection('reviews').doc(reviewId)

  await db.runTransaction(async tx => {
    // 1. Atomic duplicate guard
    const existing = await tx.get(reviewRef)
    if (existing.exists) {
      logger.security('review_duplicate_attempt', { uid, orderId: input.orderId })
      void updateFraudScore(uid, 5, 'duplicate_review')
      throw new functions.https.HttpsError(
        'already-exists',
        'You have already reviewed this order',
        { code: 'ORD_003' },
      )
    }

    // 2. Write review — Admin SDK only (client rules deny all writes to /reviews)
    tx.set(reviewRef, {
      id:                reviewId,
      orderId:           input.orderId,
      reviewerId:        uid,
      reviewerName:      (userData['displayName'] as string) ?? '',
      reviewerAvatarUrl: (userData['avatarUrl'] as string | undefined) ?? null,
      targetId:          input.targetId,
      targetType:        input.targetType,
      rating:            input.rating,
      comment:           input.comment ?? null,
      tags:              input.tags,
      createdAt:         admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:         admin.firestore.FieldValue.serverTimestamp(),
    })

    // 3. Atomically update provider avgRating in same transaction
    if (input.targetType === 'provider') {
      const profileRef = db.collection('providerProfiles').doc(input.targetId)
      const profileDoc = await tx.get(profileRef)
      if (profileDoc.exists) {
        const profile      = profileDoc.data()!
        const currentTotal = ((profile['avgRating'] as number) ?? 0) *
                             ((profile['totalReviews'] as number) ?? 0)
        const newCount     = ((profile['totalReviews'] as number) ?? 0) + 1
        const newAvg       = (currentTotal + input.rating) / newCount

        tx.update(profileRef, {
          avgRating:    Math.round(newAvg * 10) / 10,
          totalReviews: newCount,
          updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
        })
      }
    }
  })

  const result = { ok: true as const, reviewId }

  // ── Store idempotency result — 24h TTL, cleaned up by scheduled job ──────────
  if (input.idempotencyKey) {
    const keyDocId = `review_${input.idempotencyKey}_${uid}`
    await db.collection('_idempotencyKeys').doc(keyDocId).set({
      uid,
      result,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    })
  }

  // ── Anomaly detection: burst of reviews targeting same counterparty ───────────
  // Queries up to 5 reviews from this user for this target. ≥4 triggers alert.
  const burstSnap = await db.collection('reviews')
    .where('reviewerId', '==', uid)
    .where('targetId',   '==', input.targetId)
    .limit(5)
    .get()

  if (burstSnap.size >= 4) {
    logger.security('review_burst_anomaly', {
      uid,
      targetId:   input.targetId,
      targetType: input.targetType,
      count:      burstSnap.size,
    })
  }

  logger.info('review_submitted', {
    uid,
    reviewId,
    orderId:    input.orderId,
    targetId:   input.targetId,
    targetType: input.targetType,
    rating:     input.rating,
  })

  return result
})

// ── openDispute ───────────────────────────────────────────────────────────────

export const openDispute = callable(async (data, context) => {
  const { uid } = requireAuth(context)

  await rateLimit(uid, 'api')

  const input = validate(z.object({
    orderId:      z.string().trim().min(1).max(128),
    reason:       z.string().trim().min(1).max(200),
    description:  z.string().trim().min(20).max(1000),
    evidenceUrls: z.array(z.string().url()).max(5).default([]),
  }), data)

  const orderDoc = await db.collection('orders').doc(input.orderId).get()
  if (!orderDoc.exists) appError('ORD_001', 'Order not found', 'not-found')

  const order = orderDoc.data() as Order
  if (order.customerId !== uid && order.providerId !== uid) {
    logger.security('dispute_not_party', { uid, orderId: input.orderId })
    appError('AUTH_002', 'You are not a party to this order', 'permission-denied')
  }
  if (!['completed', 'closed', 'in_progress'].includes(order.status)) {
    logger.warn('dispute_invalid_order_status', { uid, orderId: input.orderId, status: order.status })
    appError('ORD_002', 'Cannot open dispute for this order status')
  }

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
    createdAt:     admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
  })

  await db.collection('orders').doc(input.orderId).update({
    status:       'disputed',
    escrowFrozen: true,
    updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
  })

  await db.collection('adminTasks').add({
    type:        'dispute_review',
    disputeId:   disputeRef.id,
    orderId:     input.orderId,
    initiatorId: uid,
    respondentId,
    priority:    'high',
    status:      'pending',
    createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
    expiresAt:   new Date(Date.now() + 48 * 3600_000),
  })

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

  logger.info('dispute_opened', {
    uid,
    disputeId:   disputeRef.id,
    orderId:     input.orderId,
    respondentId,
  })

  return { ok: true, disputeId: disputeRef.id }
})
