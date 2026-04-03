// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiter — sliding window counter stored in Firestore
// Protects against abuse on Auth, Payments, and Order creation endpoints
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions'
import { db } from './helpers'

interface RateLimitConfig {
  windowMs:   number   // window size in milliseconds
  maxHits:    number   // max requests per window
  keyPrefix:  string   // e.g. 'auth_otp', 'payment', 'order_create'
}

const LIMITS: Record<string, RateLimitConfig> = {
  // OTP — max 5 per hour per phone
  auth_otp: { windowMs: 3600_000, maxHits: 5,  keyPrefix: 'otp' },
  // Payment initiation — max 10 per hour per user
  payment:  { windowMs: 3600_000, maxHits: 10, keyPrefix: 'pay' },
  // Order creation — max 20 per hour per user
  order:    { windowMs: 3600_000, maxHits: 20, keyPrefix: 'ord' },
  // Quote submission — max 30 per hour per provider
  quote:    { windowMs: 3600_000, maxHits: 30, keyPrefix: 'qte' },
  // KYC upload — max 3 per day per user
  kyc:      { windowMs: 86400_000, maxHits: 3, keyPrefix: 'kyc' },
  // General API — max 100 per minute per user
  api:      { windowMs: 60_000,   maxHits: 100, keyPrefix: 'api' },
}

/**
 * Check rate limit. Throws HttpsError if exceeded.
 * @param uid       Firebase user ID (or IP for unauthenticated)
 * @param limitKey  Key from LIMITS above
 */
export async function checkRateLimit(uid: string, limitKey: string): Promise<void> {
  const config = LIMITS[limitKey]
  if (!config) return  // unknown key = no limit

  const now      = Date.now()
  const windowStart = now - config.windowMs
  const docId    = `${config.keyPrefix}_${uid}`
  const ref      = db.collection('_rateLimits').doc(docId)

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref)
    const data = snap.data() as { hits: number[]; blocked?: boolean } | undefined

    // Filter hits within the current window
    const hits = (data?.hits ?? []).filter((t: number) => t > windowStart)

    if (hits.length >= config.maxHits) {
      const retryAfter = Math.ceil((hits[0]! + config.windowMs - now) / 1000)
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Rate limit exceeded. Retry after ${retryAfter}s`,
        { code: 'GEN_002', retryAfter },
      )
    }

    // Add current hit
    hits.push(now)
    tx.set(ref, {
      hits,
      lastHit:   now,
      updatedAt: now,
    }, { merge: true })
  })
}

/**
 * Convenience wrapper — call at the top of a Cloud Function handler
 */
export async function rateLimit(uid: string, key: string): Promise<void> {
  await checkRateLimit(uid, key)
}

/**
 * Clean up old rate limit documents (call from a scheduled function)
 */
export async function cleanupRateLimits(): Promise<void> {
  const cutoff = Date.now() - 86400_000  // 24 hours ago
  const snap = await db.collection('_rateLimits')
    .where('lastHit', '<', cutoff)
    .limit(500)
    .get()

  const batch = db.batch()
  snap.docs.forEach(d => batch.delete(d.ref))
  if (!snap.empty) await batch.commit()

  functions.logger.info(`Cleaned ${snap.size} stale rate limit docs`)
}
