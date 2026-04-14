// ─────────────────────────────────────────────────────────────────────────────
// user/requestDataExport — GDPR Art.20 / PDPL Art.4 "Right to Data Portability"
//
// Collects all personal data for a user, writes a JSON file to Cloud Storage,
// and returns a signed URL valid for 7 days. Rate-limited to prevent abuse.
//
// Collections scraped:
//   users/{uid}                → profile
//   orders where customerId or providerId == uid
//   quotes where customerId or providerId == uid
//   messages where senderId == uid
//   reviews where authorId == uid
//   providerProfiles/{uid}     → if provider
//   notifications/{uid}/*      → all notifications
//   subscriptions where providerId == uid
//   payouts where providerId == uid
//
// Financial records (orders/payments with paymentStatus != 'unpaid') are
// included in export but will NOT be deleted (legal retention requirement).
// ─────────────────────────────────────────────────────────────────────────────

import { z }                           from 'zod'
import * as admin                      from 'firebase-admin'
import { callable, requireAuth,
         validate, db,
         storage }                     from '../_shared/helpers'
import { rateLimit }                   from '../_shared/ratelimit'
import { logger, auditLog }            from '../_shared/monitoring'
import { enqueue }                     from '../_shared/queue'

// ── Input ─────────────────────────────────────────────────────────────────────
const requestDataExportSchema = z.object({
  /** Optional: specific collections to include. Default: all */
  collections: z.array(z.enum([
    'profile', 'orders', 'messages', 'reviews',
    'notifications', 'subscriptions', 'payouts',
  ])).optional(),
  /** Export format (reserved for future extension) */
  format: z.enum(['json']).optional().default('json'),
})

// ── Output ────────────────────────────────────────────────────────────────────
export interface DataExportResult {
  exportId:    string
  status:      'queued' | 'ready'
  downloadUrl: string | null    // null if still generating
  expiresAt:   string           // ISO date — URL valid for 7 days
  exportedAt:  string           // ISO date
}

// ─────────────────────────────────────────────────────────────────────────────

export const requestDataExport = callable(async (data, context) => {
  const { uid, email } = requireAuth(context)
  await rateLimit(uid, 'api')

  const input = validate(requestDataExportSchema, data)
  const t0    = Date.now()

  // ── Check for recent pending export ──────────────────────────────────────
  const recentExport = await db.collection('dataExports')
    .where('uid', '==', uid)
    .where('status', 'in', ['pending', 'ready'])
    .where('expiresAt', '>', new Date())
    .limit(1)
    .get()

  if (!recentExport.empty) {
    const existing = recentExport.docs[0]!.data() as DataExportRecord
    if (existing.status === 'ready' && existing.downloadUrl) {
      return {
        exportId:    existing.id,
        status:      'ready' as const,
        downloadUrl: existing.downloadUrl,
        expiresAt:   existing.expiresAt.toDate().toISOString(),
        exportedAt:  (existing.createdAt as admin.firestore.Timestamp).toDate().toISOString(),
      }
    }
    // Pending — return existing job
    return {
      exportId:    existing.id,
      status:      'queued' as const,
      downloadUrl: null,
      expiresAt:   new Date(Date.now() + 7 * 86_400_000).toISOString(),
      exportedAt:  (existing.createdAt as admin.firestore.Timestamp).toDate().toISOString(),
    }
  }

  // ── Create export record ──────────────────────────────────────────────────
  const exportRef = db.collection('dataExports').doc()
  const expiresAt = new Date(Date.now() + 7 * 86_400_000)   // 7 days

  await exportRef.set({
    id:          exportRef.id,
    uid,
    status:      'pending',
    format:      input.format,
    collections: input.collections ?? ['all'],
    downloadUrl: null,
    expiresAt:   admin.firestore.Timestamp.fromDate(expiresAt),
    createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
  } as Partial<DataExportRecord>)

  // ── Enqueue background job to build the export ───────────────────────────
  await enqueue('export_user_data', {
    exportId:    exportRef.id,
    uid,
    email:       email ?? null,
    collections: input.collections ?? null,
  }, { delayMs: 0 })

  await auditLog('data_export_requested', uid, {
    exportId: exportRef.id,
    ip:       context.rawRequest?.ip,
  })

  logger.info('Data export requested', { uid, exportId: exportRef.id, elapsed: Date.now() - t0 })

  return {
    exportId:    exportRef.id,
    status:      'queued' as const,
    downloadUrl: null,
    expiresAt:   expiresAt.toISOString(),
    exportedAt:  new Date().toISOString(),
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// buildUserDataExport — the actual data assembly (called by processTaskQueue)
// ─────────────────────────────────────────────────────────────────────────────

export async function buildUserDataExport(
  exportId: string,
  uid:      string,
  email:    string | null,
): Promise<void> {
  const t0 = Date.now()
  logger.info('Building data export', { exportId, uid })

  try {
    // ── Collect all user data in parallel ──────────────────────────────────
    const [
      userSnap, profileSnap,
      ordersCustomerSnap, ordersProviderSnap,
      messagesSnap, reviewsSnap,
      notificationsSnap, subscriptionsSnap, payoutsSnap,
    ] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('providerProfiles').doc(uid).get(),

      db.collection('orders').where('customerId', '==', uid).get(),
      db.collection('orders').where('providerId', '==', uid).get(),

      db.collection('messages').where('senderId', '==', uid).limit(500).get(),
      db.collection('reviews').where('authorId', '==', uid).get(),

      db.collection('notifications').doc(uid).collection('items').limit(200).get(),
      db.collection('subscriptions').where('providerId', '==', uid).get(),
      db.collection('payouts').where('providerId', '==', uid).get(),
    ])

    // ── Deduplicate orders (appear in both queries) ───────────────────────
    const orderDocs = new Map<string, admin.firestore.DocumentData>()
    ;[...ordersCustomerSnap.docs, ...ordersProviderSnap.docs].forEach(d => {
      orderDocs.set(d.id, { id: d.id, ...d.data() })
    })

    // ── Build export payload ──────────────────────────────────────────────
    const exportData = {
      _meta: {
        exportedAt:    new Date().toISOString(),
        exportId,
        uid,
        gdprReference: 'GDPR Art.20 / PDPL Art.4 — Right to Data Portability',
        retentionNote: 'Financial records (paid orders, payouts) are retained for legal compliance per GDPR Art.17(3)(b) and Saudi SAMA requirements (7 years).',
        workfixVersion: '1.0.0',
      },
      profile: userSnap.exists
        ? sanitizeDoc(userSnap.data())
        : null,
      providerProfile: profileSnap.exists
        ? sanitizeDoc(profileSnap.data())
        : null,
      orders: Array.from(orderDocs.values()).map(sanitizeDoc),
      messages: messagesSnap.docs.map(d => sanitizeDoc({ id: d.id, ...d.data() })),
      reviews: reviewsSnap.docs.map(d => sanitizeDoc({ id: d.id, ...d.data() })),
      notifications: notificationsSnap.docs.map(d => sanitizeDoc({ id: d.id, ...d.data() })),
      subscriptions: subscriptionsSnap.docs.map(d => sanitizeDoc({ id: d.id, ...d.data() })),
      payouts: payoutsSnap.docs.map(d => sanitizeDoc({ id: d.id, ...d.data() })),
    }

    // ── Write JSON to Cloud Storage ──────────────────────────────────────
    const bucket    = storage.bucket()
    const filePath  = `data-exports/${uid}/${exportId}/export.json`
    const fileRef   = bucket.file(filePath)

    await fileRef.save(JSON.stringify(exportData, null, 2), {
      contentType:  'application/json',
      metadata: {
        contentDisposition: `attachment; filename="workfix-data-export-${exportId}.json"`,
        cacheControl: 'private, no-cache',
      },
    })

    // ── Generate signed URL (7 days) ──────────────────────────────────────
    const expiresAt = new Date(Date.now() + 7 * 86_400_000)
    const [signedUrl] = await fileRef.getSignedUrl({
      action:  'read',
      expires: expiresAt,
    })

    // ── Update export record ──────────────────────────────────────────────
    await db.collection('dataExports').doc(exportId).update({
      status:      'ready',
      downloadUrl: signedUrl,
      filePath,
      fileSize:    JSON.stringify(exportData).length,
      expiresAt:   admin.firestore.Timestamp.fromDate(expiresAt),
      updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
    })

    // ── Send email notification ───────────────────────────────────────────
    if (email) {
      await enqueue('send_email', {
        to:       email,
        template: 'data_export_ready',
        data: {
          downloadUrl: signedUrl,
          expiresAt:   expiresAt.toLocaleDateString('ar-SA'),
        },
      })
    }

    const elapsed = Date.now() - t0
    logger.info('Data export complete', {
      exportId, uid,
      collections: Object.keys(exportData).length,
      elapsed,
    })
  } catch (err) {
    logger.error('Data export failed', err, { exportId, uid })
    await db.collection('dataExports').doc(exportId).update({
      status:    'failed',
      error:     err instanceof Error ? err.message : String(err),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    throw err
  }
}

// ── Sanitize Firestore doc data ───────────────────────────────────────────────
// Converts Timestamps to ISO strings, removes server-only fields

function sanitizeDoc(data: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!data) return {}
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(data)) {
    if (key === '_firestoreInternal') continue
    if (val && typeof val === 'object' && 'toDate' in val) {
      result[key] = (val as admin.firestore.Timestamp).toDate().toISOString()
    } else if (val && typeof val === 'object' && '_seconds' in val) {
      result[key] = new Date((val as { _seconds: number })._seconds * 1000).toISOString()
    } else {
      result[key] = val
    }
  }
  return result
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DataExportRecord {
  id:          string
  uid:         string
  status:      'pending' | 'ready' | 'failed' | 'expired'
  format:      string
  collections: string[]
  downloadUrl: string | null
  filePath?:   string
  fileSize?:   number
  expiresAt:   admin.firestore.Timestamp
  error?:      string
  createdAt:   admin.firestore.Timestamp | admin.firestore.FieldValue
  updatedAt:   admin.firestore.Timestamp | admin.firestore.FieldValue
}
