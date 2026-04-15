// ─────────────────────────────────────────────────────────────────────────────
// Server-side App Check enforcement
//
// Firebase App Check tokens are verified by the Firebase Admin SDK on every
// callable / HTTP function call.  This module provides:
//   1. requireAppCheck()  — hard block: rejects calls without a valid token
//   2. softAppCheck()     — soft block: logs missing token but allows the call
//                           (use during rollout / debug builds)
//
// Configuration:
//   Set ENFORCE_APP_CHECK=true in Firebase Functions environment config to
//   switch from soft to hard enforcement globally.
//   Individual functions can always call requireAppCheck() directly.
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

// ── App Check token verification ──────────────────────────────────────────────

/**
 * Hard enforcement: throw 'unauthenticated' if App Check token is absent or
 * invalid.  Use on all payment, auth-escalation, and admin endpoints.
 *
 * @param context  Firebase callable context
 */
export function requireAppCheck(context: functions.https.CallableContext): void {
  if (!context.app) {
    functions.logger.warn('App Check token missing — request blocked', {
      uid:    context.auth?.uid ?? 'unauthenticated',
      origin: (context.rawRequest as { ip?: string }).ip,
    })
    throw new functions.https.HttpsError(
      'unauthenticated',
      'This function requires a valid App Check token.',
      { code: 'AUTH_003' },
    )
  }
}

/**
 * Soft enforcement: log a warning but allow the call through.
 * Use during App Check rollout so existing users are not suddenly blocked.
 * Switch to requireAppCheck() once the new app version has sufficient adoption.
 *
 * @param context  Firebase callable context
 * @param fnName   Name of the calling function (for log clarity)
 */
export function softAppCheck(
  context: functions.https.CallableContext,
  fnName: string,
): void {
  if (!context.app) {
    functions.logger.warn(`[AppCheck:soft] Missing token in ${fnName}`, {
      uid:    context.auth?.uid ?? 'unauthenticated',
      origin: (context.rawRequest as { ip?: string }).ip,
    })
    // Do NOT throw — soft mode allows the call through
  }
}

// ── Token verification for HTTP functions (webhooks etc.) ────────────────────

/**
 * Verify an App Check token from an HTTP (non-callable) function.
 * Use for webhook endpoints that need to verify they're called by a real app.
 *
 * @param req  Express/Firebase Request
 * @returns    true if the token is valid
 */
export async function verifyAppCheckToken(
  req: functions.https.Request,
): Promise<boolean> {
  const token = req.headers['x-firebase-appcheck'] as string | undefined
  if (!token) return false

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(token)
    functions.logger.debug('App Check token verified', { sub: appCheckClaims.appId })
    return true
  } catch (err) {
    functions.logger.warn('App Check token verification failed', { err })
    return false
  }
}

/**
 * Middleware variant: blocks HTTP requests without a valid App Check token.
 *
 * @param req  Firebase HTTP request
 * @param res  Firebase HTTP response
 * @returns    true if the request should proceed; false if it was rejected
 */
export async function requireAppCheckHTTP(
  req: functions.https.Request,
  res: { status(code: number): { json(body: unknown): void } },
): Promise<boolean> {
  const valid = await verifyAppCheckToken(req)
  if (!valid) {
    functions.logger.warn('HTTP endpoint blocked: missing/invalid App Check token', {
      ip:   req.ip,
      path: req.path,
    })
    res.status(401).json({ error: 'App Check token required', code: 'AUTH_003' })
    return false
  }
  return true
}
