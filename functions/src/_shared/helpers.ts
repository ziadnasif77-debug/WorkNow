// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers used across all Cloud Functions
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { ZodSchema } from 'zod'
import type { UserRole, ApiError, ErrorCode } from '@workfix/types'

export const db = admin.firestore()
export const auth = admin.auth()
export const storage = admin.storage()
export const messaging = admin.messaging()

// ── Error factory ─────────────────────────────────────────────────────────────

export function appError(
  code: string,  // ErrorCode key or value
  message: string,
  httpCode: functions.https.FunctionsErrorCode = 'invalid-argument',
): never {
  throw new functions.https.HttpsError(httpCode, message, { code })
}

// ── Auth guard ────────────────────────────────────────────────────────────────

export interface AuthContext {
  uid: string
  role: UserRole
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
  const role = (claims['role'] as UserRole | undefined) ?? 'customer'

  if (allowedRoles && !allowedRoles.includes(role)) {
    appError('AUTH_002', `Role '${role}' is not allowed for this operation`, 'permission-denied')
  }

  return {
    uid: context.auth.uid,
    role,
    email: claims.email,
    phone: claims.phone_number }
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

// ── Callable wrapper (adds consistent error handling) ─────────────────────────

type CallableHandler<T, R> = (
  data: T,
  context: functions.https.CallableContext,
) => Promise<R>

export function callable<T, R>(handler: CallableHandler<T, R>) {
  return functions
    .region('me-central1') // Middle East region (closest to MENA)
    .https.onCall(async (data: T, context) => {
      try {
        return await handler(data, context)
      } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err
        functions.logger.error('Unhandled function error', { err })
        throw new functions.https.HttpsError(
          'internal',
          'An internal error occurred',
          { code: 'GEN_001' } satisfies Pick<ApiError, 'code'>,
        )
      }
    })
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
