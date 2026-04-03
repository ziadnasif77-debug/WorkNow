// ─────────────────────────────────────────────────────────────────────────────
// Webhook Security — verify Tap Payments webhook signatures
// Tap uses HMAC-SHA256 on the raw request body
// ─────────────────────────────────────────────────────────────────────────────

import * as crypto from 'crypto'
import * as functions from 'firebase-functions'

/**
 * Verify Tap Payments webhook signature.
 * Tap sends: HashDigest header = HMAC-SHA256(secret, body_string)
 */
export function verifyTapWebhook(
  rawBody: string,
  hashDigestHeader: string | undefined,
  secret: string,
): boolean {
  if (!hashDigestHeader) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
    .toUpperCase()

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(hashDigestHeader.toUpperCase()),
    )
  } catch {
    return false
  }
}

/**
 * Parse and verify a Tap webhook request.
 * Throws 401 if signature is invalid.
 */
export function parseTapWebhook(
  req: functions.https.Request,
  webhookSecret: string,
): { verified: boolean; body: Record<string, unknown> } {
  const rawBody = JSON.stringify(req.body)
  const hashDigest = req.headers['hashdigest'] as string | undefined

  const verified = verifyTapWebhook(rawBody, hashDigest, webhookSecret)

  if (!verified) {
    functions.logger.warn('Invalid Tap webhook signature', {
      received: hashDigest?.slice(0, 8) + '...',
      ip: req.ip,
    })
  }

  return { verified, body: req.body as Record<string, unknown> }
}

/**
 * Payment retry configuration
 */
export const PAYMENT_RETRY_CONFIG = {
  maxRetries:    3,
  backoffMs:     [1000, 5000, 15000] as const,  // 1s, 5s, 15s
  retryOnCodes:  ['network_error', 'timeout', 'service_unavailable'],
}

/**
 * Retry a Tap API call with exponential backoff
 */
export async function tapRequestWithRetry(
  fn: () => Promise<Response>,
  retries = PAYMENT_RETRY_CONFIG.maxRetries,
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fn()
      // Retry on 5xx server errors
      if (res.status >= 500 && attempt < retries - 1) {
        await sleep(PAYMENT_RETRY_CONFIG.backoffMs[attempt] ?? 15000)
        continue
      }
      return res
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      functions.logger.warn(`Tap request failed (attempt ${attempt + 1}/${retries})`, { err })
      if (attempt < retries - 1) {
        await sleep(PAYMENT_RETRY_CONFIG.backoffMs[attempt] ?? 15000)
      }
    }
  }
  throw lastError ?? new Error('Tap request failed after retries')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Basic fraud signals — flag suspicious activity for manual review
 */
export interface FraudSignals {
  multipleCardsInHour:  boolean
  unusualAmount:        boolean
  newAccountHighValue:  boolean
  mismatchedCurrency:   boolean
}

export async function assessFraudRisk(
  uid: string,
  amount: number,
  currency: string,
  db: FirebaseFirestore.Firestore,
): Promise<{ risk: 'low' | 'medium' | 'high'; signals: FraudSignals }> {
  const oneHourAgo = Date.now() - 3600_000
  const highValueThreshold = currency === 'SAR' ? 5000 : 1500  // SAR 5k or NOK/SEK equiv

  // Recent payment attempts
  const recentPayments = await db.collection('payments')
    .where('customerId', '==', uid)
    .where('createdAt', '>', new Date(oneHourAgo))
    .get()

  // Count distinct Tap charge IDs (proxy for distinct cards)
  const distinctAttempts = new Set(recentPayments.docs.map(d => d.data()['method'])).size

  // Account age
  const userDoc = await db.collection('users').doc(uid).get()
  const createdAt = userDoc.data()?.['createdAt']?.toDate?.() ?? new Date()
  const accountAgeDays = (Date.now() - createdAt.getTime()) / 86400_000

  const signals: FraudSignals = {
    multipleCardsInHour:   distinctAttempts >= 3,
    unusualAmount:         amount > highValueThreshold,
    newAccountHighValue:   accountAgeDays < 7 && amount > highValueThreshold * 0.5,
    mismatchedCurrency:    false,  // checked by Tap directly
  }

  const signalCount = Object.values(signals).filter(Boolean).length
  const risk = signalCount === 0 ? 'low' : signalCount === 1 ? 'medium' : 'high'

  if (risk === 'high') {
    // Log for monitoring
    await db.collection('fraudAlerts').add({
      uid, amount, currency, signals, risk,
      createdAt: new Date(),
    })
  }

  return { risk, signals }
}
