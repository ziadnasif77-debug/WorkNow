// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers used across all Cloud Functions
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { AsyncLocalStorage } from 'async_hooks'
import { randomUUID } from 'crypto'
import type { ZodSchema } from 'zod'
import type { UserRole, ApiError } from '@workfix/types'
import { requireAppCheck } from './appCheck'

export const db        = admin.firestore()
export const auth      = admin.auth()
export const storage   = admin.storage()
export const messaging = admin.messaging()

// ── Request-scoped correlationId propagation ──────────────────────────────────
// Uses Node.js AsyncLocalStorage so every log call within a request
// automatically inherits the correlationId without passing it explicitly.

interface RequestStore {
  correlationId: string
  uid?:          string
}

export const requestStore = new AsyncLocalStorage<RequestStore>()

export function getCorrelationId(): string {
  return requestStore.getStore()?.correlationId ?? 'no-ctx'
}

// ── Error factory ─────────────────────────────────────────────────────────────

export function appError(
  code: string,
  message: string,
  httpCode: functions.https.FunctionsErrorCode = 'invalid-argument',
): never {
  throw new functions.https.HttpsError(httpCode, message, { code })
}

// ── Auth guard ────────────────────────────────────────────────────────────────

export interface AuthContext {
  uid:    string
  role:   UserRole
  email?: string
  phone?: string
}

export function requireAuth(
  context: functions.https.CallableContext,
  allowedRoles?: UserRole[],
): AuthContext {
  if (!context.auth) {
    appError('AUTH_001', 'Authentication required', 'unauthenticated')
  }

  const claims = context.auth.token
  const role   = (claims['role'] as UserRole | undefined) ?? 'customer'

  if (allowedRoles && !allowedRoles.includes(role)) {
    appError('AUTH_002', `Role '${role}' is not allowed for this operation`, 'permission-denied')
  }

  return {
    uid: context.auth.uid,
    role,
    ...(claims.email        !== undefined && { email: claims.email }),
    ...(claims.phone_number !== undefined && { phone: claims.phone_number }),
  }
}

// ── Zod validation wrapper ────────────────────────────────────────────────────

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    appError('VAL_001', `Validation failed: ${issues}`)
  }
  return result.data
}

// ── Callable wrapper ──────────────────────────────────────────────────────────
// Adds: App Check enforcement, correlationId propagation, structured entry/exit
// logs, and consistent error handling.

type CallableHandler<T, R> = (
  data:    T,
  context: functions.https.CallableContext,
) => Promise<R>

export function callable<T, R>(handler: CallableHandler<T, R>) {
  return functions
    .region('me-central1')
    .https.onCall(async (data: T, context) => {
      requireAppCheck(context)

      const correlationId = randomUUID()
      const uid           = context.auth?.uid

      return requestStore.run({ correlationId, ...(uid !== undefined && { uid }) }, async () => {
        functions.logger.info('[CF] request_start', {
          correlationId,
          fn:  handler.name || 'anonymous',
          uid: uid ?? 'unauthenticated',
        })

        try {
          const result = await handler(data, context)
          functions.logger.info('[CF] request_complete', {
            correlationId,
            fn: handler.name || 'anonymous',
          })
          return result
        } catch (err) {
          if (err instanceof functions.https.HttpsError) throw err
          functions.logger.error('Unhandled function error', {
            err,
            correlationId,
            fn: handler.name || 'anonymous',
          })
          throw new functions.https.HttpsError(
            'internal',
            'An internal error occurred',
            { code: 'GEN_001' } satisfies Pick<ApiError, 'code'>,
          )
        }
      })
    })
}

// ── HTTP security headers ─────────────────────────────────────────────────────
// Apply to all onRequest (HTTP) function responses — not applicable to
// callable functions (their HTTP layer is managed by Firebase SDK).

export function addSecurityHeaders(res: { set(field: string, value: string): unknown }): void {
  res.set('X-Content-Type-Options',    'nosniff')
  res.set('X-Frame-Options',           'DENY')
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.set('X-XSS-Protection',          '1; mode=block')
  res.set('Content-Security-Policy',   "default-src 'none'")
  res.set('Cache-Control',             'no-store, no-cache, must-revalidate')
  res.set('Referrer-Policy',           'no-referrer')
}

// ── Firestore helpers ─────────────────────────────────────────────────────────

export function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp()
}

export function arrayUnion(...items: unknown[]) {
  return admin.firestore.FieldValue.arrayUnion(...items)
}

export function increment(n: number) {
  return admin.firestore.FieldValue.increment(n)
}
