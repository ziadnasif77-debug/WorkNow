// ─────────────────────────────────────────────────────────────────────────────
// firebaseErrorMap — translate Firebase / Cloud Functions errors to i18n keys
//
// Usage:
//   import { mapFirebaseError } from '../lib/firebaseErrorMap'
//   const msg = mapFirebaseError(err)   // returns translated string
// ─────────────────────────────────────────────────────────────────────────────

import i18n from './i18n'

const t = (key: string, opts?: Record<string, unknown>) =>
  i18n.t(key, { defaultValue: i18n.t('common.error'), ...opts }) as string

/**
 * Maps a Firebase HttpsError to a display string.
 *
 * Priority:
 *   1. Known Firebase/Functions error CODE → translated i18n string
 *   2. Error has a non-empty message → return the raw message as-is
 *   3. No message → return `fallback` (if provided) or generic Arabic error
 *
 * @param err      The caught error (any type)
 * @param fallback Arabic string shown when the error carries no message
 */
export function mapFirebaseError(err: unknown, fallback?: string): string {
  const generic = fallback ?? t('common.error')

  if (!err || typeof err !== 'object') return generic

  const e = err as { code?: string; message?: string }

  // ── Map by HttpsError code ─────────────────────────────────────────────────
  switch (e.code) {
    case 'functions/unauthenticated':
    case 'auth/not-authenticated':
      return t('errors.unauthenticated')

    case 'functions/permission-denied':
      return t('errors.permissionDenied')

    case 'functions/not-found':
      return t('errors.notFound')

    case 'functions/resource-exhausted':
      return t('errors.rateLimitExceeded')

    case 'functions/invalid-argument':
      return t('errors.invalidAmount')

    case 'functions/internal':
      return t('common.error')
  }

  // ── Pass through raw message when present ─────────────────────────────────
  const msg = e.message ?? ''
  if (msg) return msg

  // ── No message — use caller-supplied fallback or generic ──────────────────
  return generic
}

