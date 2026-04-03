// ─────────────────────────────────────────────────────────────────────────────
// Functions Monitoring — structured logging for Cloud Functions
// All errors automatically go to Firebase Error Reporting + Cloud Logging
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions'

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
    functions.logger.info(message, { severity: 'INFO', ...ctx }),

  warn: (message: string, ctx?: LogContext) =>
    functions.logger.warn(message, { severity: 'WARNING', ...ctx }),

  error: (message: string, err?: unknown, ctx?: LogContext) => {
    const errObj = err instanceof Error
      ? { errorMessage: err.message, stack: err.stack }
      : { error: String(err) }
    functions.logger.error(message, { severity: 'ERROR', ...errObj, ...ctx })
  },

  // Payment-specific — always log with high severity
  payment: (event: string, data: Record<string, unknown>) =>
    functions.logger.info(`[PAYMENT] ${event}`, {
      severity: 'NOTICE',
      paymentEvent: event,
      ...data,
    }),

  // Security events — always log
  security: (event: string, data: Record<string, unknown>) =>
    functions.logger.warn(`[SECURITY] ${event}`, {
      severity: 'WARNING',
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

// ── Audit log ─────────────────────────────────────────────────────────────────
// Critical actions written to Firestore for compliance

import { db } from './helpers'

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
