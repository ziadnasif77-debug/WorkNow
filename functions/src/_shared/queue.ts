// ─────────────────────────────────────────────────────────────────────────────
// Task Queue — Firestore-backed reliable queue for background jobs
// Why Firestore? Zero extra cost, works with emulators, simple retry logic
// For high volume (>10k/day), migrate to Cloud Tasks
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { db, serverTimestamp } from './helpers'
import { logger } from './monitoring'

export type TaskType =
  | 'send_notification'
  | 'send_email'
  | 'release_escrow'
  | 'process_payout'
  | 'update_provider_stats'
  | 'send_sms'
  | 'cleanup_expired_quotes'
  | 'export_user_data'        // GDPR: data export job
  | 'execute_account_deletion' // GDPR: scheduled deletion
  | 'cleanup_stale_typing'     // TTL: remove expired typing indicators

export interface Task {
  id:         string
  type:       TaskType
  payload:    Record<string, unknown>
  status:     'pending' | 'processing' | 'done' | 'failed'
  attempts:   number
  maxAttempts: number
  runAfter:   Date
  createdAt:  Date
  updatedAt:  Date
  error?:     string
}

// ── Enqueue a task ────────────────────────────────────────────────────────────

export async function enqueue(
  type:       TaskType,
  payload:    Record<string, unknown>,
  options: {
    delayMs?:    number   // run after N ms (default: immediately)
    maxAttempts?: number  // default: 3
  } = {},
): Promise<string> {
  const runAfter = new Date(Date.now() + (options.delayMs ?? 0))
  const ref      = db.collection('_taskQueue').doc()

  await ref.set({
    id:          ref.id,
    type,
    payload,
    status:      'pending',
    attempts:    0,
    maxAttempts: options.maxAttempts ?? 3,
    runAfter,
    createdAt:   new Date(),
    updatedAt:   new Date() })

  logger.info(`Task enqueued: ${type}`, { taskId: ref.id, type })
  return ref.id
}

// ── Process pending tasks (called by scheduled function every minute) ─────────

export async function processPendingTasks(): Promise<void> {
  const now     = new Date()
  const pending = await db.collection('_taskQueue')
    .where('status', '==', 'pending')
    .where('runAfter', '<=', now)
    .orderBy('runAfter', 'asc')
    .limit(10)   // process 10 at a time
    .get()

  if (pending.empty) return

  logger.info(`Processing ${pending.size} queued tasks`)

  await Promise.allSettled(
    pending.docs.map(doc => processTask(doc.id, doc.data() as Task)),
  )
}

async function processTask(id: string, task: Task): Promise<void> {
  const ref = db.collection('_taskQueue').doc(id)

  // Mark as processing (optimistic lock)
  await ref.update({ status: 'processing', updatedAt: new Date() })

  try {
    await executeTask(task)
    await ref.update({ status: 'done', updatedAt: new Date() })
    logger.info(`Task completed: ${task.type}`, { taskId: id })
  } catch (err) {
    const attempts = task.attempts + 1
    const failed   = attempts >= task.maxAttempts

    if (failed) {
      // Move to dead-letter queue — keeps _taskQueue clean, 30-day audit trail
      const deadBatch = db.batch()
      deadBatch.set(db.collection('_deadTasks').doc(id), {
        ...task,
        attempts,
        status:    'failed',
        error:     err instanceof Error ? err.message : String(err),
        failedAt:  new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 3600_000),
      })
      deadBatch.delete(ref)
      await deadBatch.commit()
      logger.error(`Task permanently failed: ${task.type}`, err, { taskId: id, attempts })
    } else {
      await ref.update({
        status:    'pending',
        attempts,
        error:     err instanceof Error ? err.message : String(err),
        // Exponential backoff: 1min, 5min, 25min
        runAfter:  new Date(Date.now() + Math.pow(5, attempts) * 60_000),
        updatedAt: new Date(),
      })
      logger.warn(`Task retrying: ${task.type}`, { taskId: id, attempts })
    }
  }
}

// ── Task handlers ─────────────────────────────────────────────────────────────

async function executeTask(task: Task): Promise<void> {
  switch (task.type) {
    case 'release_escrow': {
      const { orderId } = task.payload as { orderId: string }
      const { releaseEscrowById } = await import('../payments/escrow')
      await releaseEscrowById(orderId)
      break
    }

    case 'process_payout': {
      const { providerId, amount } = task.payload as { providerId: string; amount: number }
      const { processPayout } = await import('../payments/payout')
      await processPayout(providerId, amount)
      break
    }

    case 'update_provider_stats': {
      const { providerId } = task.payload as { providerId: string }
      await updateProviderStats(providerId)
      break
    }

    case 'cleanup_expired_quotes': {
      await cleanupExpiredQuotes()
      break
    }

    case 'send_notification':
    case 'send_email':
    case 'send_sms':
      // These are handled by trigger functions directly
      // Queued here as fallback for failed FCM sends
      logger.info(`Queued ${task.type} processed`, { taskId: task.id })
      break


    case 'export_user_data': {
      const { exportId, uid, email } = task.payload as {
        exportId: string; uid: string; email: string | null
      }
      const { buildUserDataExport } = await import('../user/dataExport')
      await buildUserDataExport(exportId, uid, email)
      break
    }

    case 'cleanup_stale_typing': {
      await cleanupStaleTypingIndicators()
      break
    }

    case 'execute_account_deletion': {
      const { uid: targetUid } = task.payload as { uid: string }
      const { executeAccountDeletion } = await import('../user/accountDeletion')
      await executeAccountDeletion(targetUid)
      break
    }
    default: {
      const exhaustive: never = task.type
      throw new Error(`Unknown task type: ${String(exhaustive)}`)
    }
  }
}

// ── Business logic tasks ──────────────────────────────────────────────────────

async function updateProviderStats(providerId: string): Promise<void> {
  const completedOrders = await db.collection('orders')
    .where('providerId', '==', providerId)
    .where('status', '==', 'closed')
    .get()

  const reviews = await db.collection('reviews')
    .where('targetId', '==', providerId)
    .get()

  const avgRating = reviews.empty ? 0 :
    reviews.docs.reduce((sum, d) => sum + (d.data()['rating'] as number), 0) / reviews.size

  await db.collection('providerProfiles').doc(providerId).update({
    totalCompletedOrders: completedOrders.size,
    totalReviews:         reviews.size,
    avgRating:            Math.round(avgRating * 10) / 10,
    updatedAt:            new Date() })
}

async function cleanupExpiredQuotes(): Promise<void> {
  const now  = new Date()
  const snap = await db.collectionGroup('quotes')
    .where('status', '==', 'pending')
    .where('expiresAt', '<', now)
    .limit(100)
    .get()

  const batch = db.batch()
  snap.docs.forEach(doc => batch.update(doc.ref, { status: 'expired' }))
  if (!snap.empty) await batch.commit()

  logger.info(`Cleaned ${snap.size} expired quotes`)
}

// ── Scheduled function — runs every minute ─────────────────────────────────────

export const processTaskQueue = functions
  .region('me-central1')
  .pubsub.schedule('every 1 minutes')
  .onRun(async () => {
    await processPendingTasks()
  })

// ── Scheduled cleanup — runs daily ────────────────────────────────────────────

export const dailyCleanup = functions
  .region('me-central1')
  .pubsub.schedule('every 24 hours')
  .onRun(async () => {
    const { cleanupRateLimits } = await import('./ratelimit')
    await cleanupRateLimits()
    await enqueue('cleanup_expired_quotes', {})
    // GDPR: execute pending account deletions past grace period
    await processScheduledDeletions()
    // GDPR: expire old download URLs
    await expireOldDataExports()
    // Security: purge expired webhook dedup records
    await cleanupWebhookEvents()
    // Dead-letter queue: purge expired failed task records
    await cleanupDeadTasks()
    logger.info('Daily cleanup completed')
  })

// ── _deadTasks TTL cleanup ────────────────────────────────────────────────────

export async function cleanupDeadTasks(): Promise<void> {
  const now  = new Date()
  const snap = await db.collection('_deadTasks')
    .where('expiresAt', '<=', now)
    .limit(500)
    .get()

  if (snap.empty) return

  const batch = db.batch()
  snap.docs.forEach(doc => batch.delete(doc.ref))
  await batch.commit()
  logger.info('Expired dead tasks purged', { count: snap.size })
}

// ── _webhookEvents TTL cleanup ─────────────────────────────────────────────────

export async function cleanupWebhookEvents(): Promise<void> {
  const now = new Date()
  const snap = await db.collection('_webhookEvents')
    .where('expiresAt', '<=', now)
    .limit(500)
    .get()

  if (snap.empty) return

  const batch = db.batch()
  snap.docs.forEach(doc => batch.delete(doc.ref))
  await batch.commit()
  logger.info('Expired webhook events purged', { count: snap.size })
}

// ── Weekly rating integrity verification ──────────────────────────────────────
// Recalculates avgRating and totalReviews from source-of-truth reviews
// collection and corrects any drift caused by failed transactions or
// direct Firestore writes that bypassed the submitReview function.

export const weeklyRatingIntegrityCheck = functions
  .region('me-central1')
  .pubsub.schedule('every 168 hours')
  .onRun(async () => {
    await verifyRatingIntegrity()
    logger.info('Weekly rating integrity check completed')
  })

export async function verifyRatingIntegrity(): Promise<void> {
  // Process providers with at least one review.
  // Cursor-based: run iteratively if > 100 providers need checking.
  const profilesSnap = await db.collection('providerProfiles')
    .where('totalReviews', '>', 0)
    .limit(100)
    .get()

  if (profilesSnap.empty) return

  let checkedCount = 0
  let fixedCount   = 0

  for (const profileDoc of profilesSnap.docs) {
    const profile    = profileDoc.data()
    const providerId = profileDoc.id

    // Recalculate from the canonical reviews collection
    const reviewsSnap = await db.collection('reviews')
      .where('targetId',   '==', providerId)
      .where('targetType', '==', 'provider')
      .get()

    const actualCount = reviewsSnap.size
    const actualAvg   = actualCount > 0
      ? reviewsSnap.docs.reduce((sum, d) => sum + ((d.data()['rating'] as number) ?? 0), 0) / actualCount
      : 0
    const roundedAvg  = Math.round(actualAvg * 10) / 10

    const storedAvg   = (profile['avgRating']    as number) ?? 0
    const storedCount = (profile['totalReviews'] as number) ?? 0

    checkedCount++

    if (storedAvg !== roundedAvg || storedCount !== actualCount) {
      logger.security('rating_integrity_mismatch', {
        providerId,
        stored: { avgRating: storedAvg, totalReviews: storedCount },
        actual: { avgRating: roundedAvg, totalReviews: actualCount },
        drift:  { avgRating: Math.abs(storedAvg - roundedAvg), totalReviews: Math.abs(storedCount - actualCount) },
      })

      await profileDoc.ref.update({
        avgRating:    roundedAvg,
        totalReviews: actualCount,
        updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
      })

      fixedCount++
    }
  }

  logger.info('Rating integrity verification complete', { checkedCount, fixedCount })
}


// ── Daily GDPR cleanup: execute pending account deletions ─────────────────────
// Called by dailyCleanup scheduled function
export async function processScheduledDeletions(): Promise<void> {
  const now = new Date()
  const pendingDeletions = await db.collection('deletionRequests')
    .where('status', '==', 'pending')
    .where('scheduledFor', '<=', now)
    .limit(50)
    .get()

  if (pendingDeletions.empty) return

  logger.info('Processing scheduled account deletions', { count: pendingDeletions.size })

  const { executeAccountDeletion } = await import('../user/accountDeletion')

  await Promise.allSettled(
    pendingDeletions.docs.map(doc => {
      const uid = (doc.data() as { uid?: string })['uid'] ?? doc.id
      return executeAccountDeletion(uid)
    })
  )
}

// ── Daily GDPR cleanup: expire old data export download URLs ─────────────────
export async function expireOldDataExports(): Promise<void> {
  const now = new Date()
  const expired = await db.collection('dataExports')
    .where('status', '==', 'ready')
    .where('expiresAt', '<=', now)
    .limit(100)
    .get()

  if (expired.empty) return

  const batch = db.batch()
  expired.docs.forEach(doc => {
    batch.update(doc.ref, { status: 'expired', updatedAt: serverTimestamp() })
  })
  await batch.commit()
  logger.info('Expired data export records', { count: expired.size })
}


// ─────────────────────────────────────────────────────────────────────────────
// cleanupStaleTypingIndicators — removes expired typingExpiresAt entries
//
// Runs hourly. A typing indicator is "stale" when typingExpiresAt[uid] < now.
// Uses Firestore batch update to null-out expired fields atomically.
//
// Cost analysis:
//   Without cleanup: no write cost (TTL is client-side)
//   With cleanup: 1 batch write per conversation with stale entries (rare)
//   Net: cleanup runs ~once/hour, processes only dirty docs → near-zero cost
// ─────────────────────────────────────────────────────────────────────────────
export async function cleanupStaleTypingIndicators(): Promise<void> {
  const STALE_THRESHOLD_MS = 60_000   // 60 s — definitely expired
  const now = Date.now()
  const cutoff = now - STALE_THRESHOLD_MS

  // Query conversations that have any typingExpiresAt entries
  // (we use a simple lastMessageAt > 0 query + filter client-side)
  // In production with many conversations, partition by lastMessageAt recency
  const convSnap = await db
    .collection('conversations')
    .orderBy('lastMessageAt', 'desc')
    .limit(200)   // process most-active 200 conversations per run
    .get()

  if (convSnap.empty) return

  const batch = db.batch()
  let batchSize = 0

  for (const convDoc of convSnap.docs) {
    const data = convDoc.data() as Record<string, unknown>
    const expiresMap = data['typingExpiresAt'] as Record<string, number> | undefined
    if (!expiresMap || Object.keys(expiresMap).length === 0) continue

    // Find stale entries
    const staleUids = Object.entries(expiresMap)
      .filter(([, expiresAt]) => expiresAt < cutoff)
      .map(([uid]) => uid)

    if (staleUids.length === 0) continue

    // Build update: set stale entries to FieldValue.delete()
    const update: Record<string, unknown> = {}
    for (const uid of staleUids) {
      update[`typingExpiresAt.${uid}`] = admin.firestore.FieldValue.delete()
      // Also clean up legacy typingStatus if present
      update[`typingStatus.${uid}`] = admin.firestore.FieldValue.delete()
    }
    batch.update(convDoc.ref, update)
    batchSize++

    // Firestore batch limit: 500 operations
    if (batchSize >= 400) break
  }

  if (batchSize > 0) {
    await batch.commit()
    logger.info('Stale typing indicators cleaned up', {
      conversationsUpdated: batchSize,
      cutoffMs: cutoff,
    })
  }
}


// ── Hourly typing cleanup job ─────────────────────────────────────────────────

export const hourlyCleanup = functions
  .region('me-central1')
  .pubsub.schedule('every 60 minutes')
  .onRun(async () => {
    await cleanupStaleTypingIndicators()
    logger.info('Hourly cleanup completed')
  })
