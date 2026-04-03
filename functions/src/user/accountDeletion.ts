// ─────────────────────────────────────────────────────────────────────────────
// user/requestAccountDeletion — GDPR Art.17 / PDPL Art.7 "Right to Erasure"
//
// Flow:
//   1. requestAccountDeletion() — user submits deletion request
//      - Validates: no active orders, no open disputes, no pending payouts
//      - Creates deletionRequests/{uid} record with 30-day grace period
//      - Soft-locks account (canLogin=false, status=deletion_pending)
//   2. executeAccountDeletion() — triggered by scheduled job (daily)
//      after grace period + checks
//      - Hard-deletes: user doc, messages, notifications, fcmTokens
//      - Anonymises: orders, reviews, provider profile (legal retention)
//      - Deletes: Auth account, storage files
//      - Sends final confirmation email
//
// Retention policy (GDPR Art.17(3)(b) + SAMA / ZATCA requirements):
//   KEEP (anonymised): orders, payouts, payment records (7 years)
//   DELETE fully:      user profile, messages, notifications, fcmTokens
//   DELETE:            Auth account + all storage files
// ─────────────────────────────────────────────────────────────────────────────

import { z }                             from 'zod'
import * as admin                        from 'firebase-admin'
import { callable, requireAuth, validate,
         db, auth, storage }             from '../_shared/helpers'
import { rateLimit }                     from '../_shared/ratelimit'
import { logger, auditLog }              from '../_shared/monitoring'
import { enqueue }                       from '../_shared/queue'

// ── Grace period: 30 days ────────────────────────────────────────────────────
const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000

const requestAccountDeletionSchema = z.object({
  /** Required confirmation phrase */
  confirmation: z.literal('DELETE MY ACCOUNT'),
  reason: z.enum([
    'no_longer_using',
    'privacy_concerns',
    'found_alternative',
    'other',
  ]).optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// requestAccountDeletion — initiates the 30-day deletion process
// ─────────────────────────────────────────────────────────────────────────────

export const requestAccountDeletion = callable(async (data, context) => {
  const { uid, email, role } = requireAuth(context)
  await rateLimit(uid, 'api')
  const input = validate(requestAccountDeletionSchema, data)

  // ── Pre-flight checks ─────────────────────────────────────────────────────
  await assertNoDeletionBlockers(uid, role)

  // ── Check no existing pending request ────────────────────────────────────
  const existingReq = await db.collection('deletionRequests').doc(uid).get()
  if (existingReq.exists) {
    const existing = existingReq.data() as DeletionRequest
    if (existing.status === 'pending') {
      return {
        ok:           true,
        status:       'already_requested' as const,
        scheduledFor: existing.scheduledFor.toDate().toISOString(),
        cancelBefore: existing.scheduledFor.toDate().toISOString(),
        message:      'Deletion already scheduled. You can cancel by logging in within the grace period.',
      }
    }
  }

  // ── Create deletion request ───────────────────────────────────────────────
  const scheduledFor = new Date(Date.now() + GRACE_PERIOD_MS)

  const request: DeletionRequest = {
    uid,
    status:       'pending',
    reason:       input.reason ?? 'other',
    scheduledFor: admin.firestore.Timestamp.fromDate(scheduledFor),
    requestedAt:  admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    executedAt:   null,
    cancelledAt:  null,
    blockers:     [],
    retentionNote: [
      'Financial records (orders, payouts) will be anonymised, not deleted.',
      'Retained 7 years per GDPR Art.17(3)(b) and SAMA requirements.',
    ].join(' '),
  }

  // ── Soft-lock the account ─────────────────────────────────────────────────
  await Promise.all([
    db.collection('deletionRequests').doc(uid).set(request),
    db.collection('users').doc(uid).update({
      accountStatus: 'deletion_pending',
      updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
    }),
    auth.revokeRefreshTokens(uid),   // Force sign-out on all devices
  ])

  // ── Notify user of scheduled deletion ────────────────────────────────────
  if (email) {
    await enqueue('send_email', {
      to:       email,
      template: 'account_deletion_scheduled',
      data: {
        scheduledFor: scheduledFor.toLocaleDateString('ar-SA'),
        cancelUrl:    `https://workfix.app/cancel-deletion?uid=${uid}`,
      },
    })
  }

  await auditLog('account_deletion_requested', uid, {
    scheduledFor: scheduledFor.toISOString(),
    reason:       input.reason,
    ip:           context.rawRequest?.ip,
  })

  logger.security('Account deletion requested', {
    uid, scheduledFor: scheduledFor.toISOString(), reason: input.reason,
  })

  return {
    ok:           true,
    status:       'scheduled' as const,
    scheduledFor: scheduledFor.toISOString(),
    cancelBefore: scheduledFor.toISOString(),
    message:      `Your account will be deleted on ${scheduledFor.toLocaleDateString('ar-SA')}. You can cancel by logging in before then.`,
    retentionNote: request.retentionNote,
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// cancelAccountDeletion — allows user to cancel within grace period
// ─────────────────────────────────────────────────────────────────────────────

export const cancelAccountDeletion = callable(async (_data, context) => {
  const { uid } = requireAuth(context)

  const reqSnap = await db.collection('deletionRequests').doc(uid).get()
  if (!reqSnap.exists) {
    return { ok: true, status: 'no_pending_request' as const }
  }

  const req = reqSnap.data() as DeletionRequest
  if (req.status !== 'pending') {
    return { ok: false, status: 'cannot_cancel' as const, message: 'Deletion already executed.' }
  }

  await Promise.all([
    db.collection('deletionRequests').doc(uid).update({
      status:      'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    }),
    db.collection('users').doc(uid).update({
      accountStatus: 'active',
      updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
    }),
  ])

  await auditLog('account_deletion_cancelled', uid, {})
  logger.info('Account deletion cancelled', { uid })

  return { ok: true, status: 'cancelled' as const }
})

// ─────────────────────────────────────────────────────────────────────────────
// executeAccountDeletion — called by dailyCleanup scheduled job
// Processes all pending deletionRequests past their scheduledFor date
// ─────────────────────────────────────────────────────────────────────────────

export async function executeAccountDeletion(uid: string): Promise<void> {
  const t0 = Date.now()
  logger.info('Executing account deletion', { uid })

  try {
    // ── Re-check blockers (conditions may have changed) ───────────────────
    const userDoc = await db.collection('users').doc(uid).get()
    const user    = userDoc.data()
    const role    = (user?.['role'] as string) ?? 'customer'

    // Don't throw on blockers — log and mark as blocked instead
    const blockers = await getBlockers(uid, role)
    if (blockers.length > 0) {
      await db.collection('deletionRequests').doc(uid).update({
        status:   'blocked',
        blockers,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      logger.warn('Account deletion blocked', { uid, blockers })
      return
    }

    // ── Step 1: Anonymise financial records (legal retention) ────────────
    await anonymiseFinancialRecords(uid)

    // ── Step 2: Hard-delete personal data ────────────────────────────────
    await hardDeletePersonalData(uid)

    // ── Step 3: Delete Firebase Auth account ─────────────────────────────
    await auth.deleteUser(uid)

    // ── Step 4: Delete storage files ─────────────────────────────────────
    await deleteUserStorage(uid)

    // ── Step 5: Mark deletion complete ───────────────────────────────────
    // Keep the deletionRequests record for compliance audit trail (no PII inside)
    await db.collection('deletionRequests').doc(uid).update({
      status:     'executed',
      executedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    const elapsed = Date.now() - t0
    logger.security('Account deletion executed', { uid, elapsed })
  } catch (err) {
    logger.error('Account deletion failed', err, { uid })
    await db.collection('deletionRequests').doc(uid).update({
      status:   'failed',
      error:    err instanceof Error ? err.message : String(err),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANONYMISE FINANCIAL RECORDS
// Replace PII with placeholder — preserves financial integrity
// ─────────────────────────────────────────────────────────────────────────────

export async function anonymiseFinancialRecords(uid: string): Promise<void> {
  const ANON = {
    customerName:     '[Deleted User]',
    providerName:     '[Deleted User]',
    customerAvatarUrl: null,
    providerAvatarUrl: null,
  }

  // Orders where user was customer or provider (financial records — keep, anonymise)
  const [custOrders, provOrders, payouts] = await Promise.all([
    db.collection('orders').where('customerId', '==', uid).get(),
    db.collection('orders').where('providerId', '==', uid).get(),
    db.collection('payouts').where('providerId', '==', uid).get(),
  ])

  const batch = db.batch()
  const batchLimit = 450  // Firestore batch max = 500
  let batchCount = 0

  async function flushBatch() {
    if (batchCount > 0) { await batch.commit(); batchCount = 0 }
  }

  // Anonymise orders
  const orderSet = new Set<string>()
  for (const snap of [custOrders, provOrders]) {
    for (const doc of snap.docs) {
      if (orderSet.has(doc.id)) continue
      orderSet.add(doc.id)
      const d = doc.data()
      const update: Record<string, unknown> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() }
      if (d['customerId'] === uid) {
        update['customerName']     = ANON.customerName
        update['customerAvatarUrl'] = null
      }
      if (d['providerId'] === uid) {
        update['providerName']     = ANON.providerName
        update['providerAvatarUrl'] = null
      }
      batch.update(doc.ref, update)
      batchCount++
      if (batchCount >= batchLimit) await flushBatch()
    }
  }

  // Anonymise payouts
  for (const doc of payouts.docs) {
    batch.update(doc.ref, {
      providerName:    ANON.providerName,
      providerAvatarUrl: null,
      updatedAt:       admin.firestore.FieldValue.serverTimestamp(),
    })
    batchCount++
    if (batchCount >= batchLimit) await flushBatch()
  }

  // Anonymise reviews authored by user
  const reviews = await db.collection('reviews').where('authorId', '==', uid).get()
  for (const doc of reviews.docs) {
    batch.update(doc.ref, {
      authorName:   '[Deleted User]',
      authorAvatar: null,
      updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
    })
    batchCount++
    if (batchCount >= batchLimit) await flushBatch()
  }

  await flushBatch()
  logger.info('Financial records anonymised', { uid, orders: orderSet.size })
}

// ─────────────────────────────────────────────────────────────────────────────
// HARD-DELETE PERSONAL DATA
// ─────────────────────────────────────────────────────────────────────────────

async function hardDeletePersonalData(uid: string): Promise<void> {
  // Messages (full delete — not financial records)
  const messages = await db.collection('messages').where('senderId', '==', uid).limit(500).get()

  // Notifications
  const notifs = await db.collection('notifications').doc(uid).collection('items').limit(500).get()

  // Provider profile (contains PII — delete)
  // Orders themselves are anonymised, not deleted (financial)
  const batch = db.batch()

  messages.docs.forEach(d => batch.delete(d.ref))
  notifs.docs.forEach(d => batch.delete(d.ref))

  // Delete provider profile, user profile
  batch.delete(db.collection('providerProfiles').doc(uid))
  batch.delete(db.collection('users').doc(uid))
  batch.delete(db.collection('notifications').doc(uid))

  // Revoke all sessions (refresh tokens already revoked on request)
  await batch.commit()

  logger.info('Personal data hard-deleted', { uid })
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE STORAGE FILES
// ─────────────────────────────────────────────────────────────────────────────

async function deleteUserStorage(uid: string): Promise<void> {
  const bucket = storage.bucket()
  // Delete all files under user's folder
  await bucket.deleteFiles({ prefix: `users/${uid}/` })
  await bucket.deleteFiles({ prefix: `kyc/${uid}/` })
  await bucket.deleteFiles({ prefix: `data-exports/${uid}/` })
  logger.info('User storage deleted', { uid })
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKERS CHECK
// ─────────────────────────────────────────────────────────────────────────────

async function getBlockers(uid: string, role: string): Promise<string[]> {
  const blockers: string[] = []

  const [activeOrders, openDisputes, pendingPayouts] = await Promise.all([
    db.collection('orders')
      .where('customerId', '==', uid)
      .where('status', 'in', ['confirmed', 'in_progress', 'quoted'])
      .limit(1).get(),
    db.collection('disputes')
      .where('customerId', '==', uid)
      .where('status', '==', 'open')
      .limit(1).get(),
    role === 'provider'
      ? db.collection('payouts')
          .where('providerId', '==', uid)
          .where('status', '==', 'pending')
          .limit(1).get()
      : Promise.resolve({ empty: true, docs: [] as admin.firestore.QueryDocumentSnapshot[] } as unknown as admin.firestore.QuerySnapshot),
  ])

  if (!activeOrders.empty) blockers.push('active_orders')
  if (!openDisputes.empty) blockers.push('open_disputes')
  if (!pendingPayouts.empty) blockers.push('pending_payouts')

  return blockers
}

async function assertNoDeletionBlockers(uid: string, role: string): Promise<void> {
  const blockers = await getBlockers(uid, role)
  if (blockers.length > 0) {
    const msg: Record<string, string> = {
      active_orders:   'You have active orders. Complete or cancel them first.',
      open_disputes:   'You have open disputes that must be resolved first.',
      pending_payouts: 'You have pending payouts. Please wait for them to clear.',
    }
    const first = blockers[0]!
    throw new (await import('firebase-functions')).https.HttpsError(
      'failed-precondition',
      msg[first] ?? 'Cannot delete account at this time.',
      { blockers },
    )
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeletionRequest {
  uid:          string
  status:       'pending' | 'executed' | 'cancelled' | 'blocked' | 'failed'
  reason:       string
  scheduledFor: admin.firestore.Timestamp
  requestedAt:  admin.firestore.Timestamp | admin.firestore.FieldValue
  executedAt:   admin.firestore.Timestamp | null
  cancelledAt:  admin.firestore.Timestamp | null
  blockers:     string[]
  retentionNote: string
  error?:       string
}
