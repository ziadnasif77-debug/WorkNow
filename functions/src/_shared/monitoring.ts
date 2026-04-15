// ─────────────────────────────────────────────────────────────────────────────
// Functions Monitoring — structured logging for Cloud Functions
// All errors automatically go to Firebase Error Reporting + Cloud Logging
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions'
import { getCorrelationId } from './helpers'

export interface LogContext {
  uid?:       string
  orderId?:   string
  function?:  string
  duration?:  number
  [key: string]:  unknown
}

// ── Structured logger ─────────────────────────────────────────────────────────

export const logger = {
  info: (message: string, ctx?: LogContext) =>
    functions.logger.info(message, { severity: 'INFO', correlationId: getCorrelationId(), ...ctx }),

  warn: (message: string, ctx?: LogContext) =>
    functions.logger.warn(message, { severity: 'WARNING', correlationId: getCorrelationId(), ...ctx }),

  error: (message: string, err?: unknown, ctx?: LogContext) => {
    const errObj = err instanceof Error
      ? { errorMessage: err.message, stack: err.stack }
      : { error: String(err) }
    functions.logger.error(message, { severity: 'ERROR', correlationId: getCorrelationId(), ...errObj, ...ctx })
  },

  // Payment-specific — always log with high severity
  payment: (event: string, data: Record<string, unknown>) =>
    functions.logger.info(`[PAYMENT] ${event}`, {
      severity:      'NOTICE',
      correlationId: getCorrelationId(),
      paymentEvent:  event,
      ...data,
    }),

  // Security events — always log
  security: (event: string, data: Record<string, unknown>) =>
    functions.logger.warn(`[SECURITY] ${event}`, {
      severity:      'WARNING',
      correlationId: getCorrelationId(),
      securityEvent: event,
      ...data,
    }),
}

// ── Function timer ────────────────────────────────────────────────────────────

export function timer(label: string): () => number {
  const start = Date.now()
  return () => {
    const duration = Date.now() - start
    if (duration > 5000) {
      logger.warn(`Slow function: ${label}`, { duration, label })
    }
    return duration
  }
}

// ── Fraud signal scoring ──────────────────────────────────────────────────────
// Accumulates a per-user fraud score (0–100). Auto-flags the account when
// the score reaches FRAUD_SCORE_FLAG_THRESHOLD.

import { db } from './helpers'

const FRAUD_SCORE_FLAG_THRESHOLD = 70

export async function updateFraudScore(
  uid:    string,
  delta:  number,
  reason: string,
): Promise<void> {
  try {
    const userRef = db.collection('users').doc(uid)
    await db.runTransaction(async tx => {
      const userSnap = await tx.get(userRef)
      if (!userSnap.exists) return

      const currentScore = (userSnap.data()!['fraudScore'] as number | undefined) ?? 0
      const newScore      = Math.min(100, Math.max(0, currentScore + delta))

      const update: Record<string, unknown> = {
        fraudScore: newScore,
        updatedAt:  new Date(),
      }

      // Auto-flag on first breach — do not clear flag automatically
      if (newScore >= FRAUD_SCORE_FLAG_THRESHOLD && !userSnap.data()!['isFlagged']) {
        update['isFlagged']  = true
        update['flaggedAt']  = new Date()
        update['flagReason'] = reason
      }

      tx.update(userRef, update)
    })

    logger.security('fraud_score_updated', { uid, delta, reason })
  } catch (err) {
    // Never break the main flow
    logger.error('Failed to update fraud score', err, { uid, delta, reason })
  }
}

// ── Audit log ─────────────────────────────────────────────────────────────────
// Critical actions written to Firestore for compliance

export async function auditLog(
  action: string,
  uid: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await db.collection('_auditLogs').add({
      action,
      uid,
      details,
      timestamp: new Date(),
      // Note: no serverTimestamp() — we want the exact time of the action
    })
  } catch (err) {
    // Audit log failure should never break the main flow
    logger.error('Failed to write audit log', err, { action, uid })
  }
}
