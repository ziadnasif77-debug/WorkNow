// ─────────────────────────────────────────────────────────────────────────────
// firebaseErrorMap — translate Firebase / Cloud Functions errors to i18n keys
//
// Usage:
//   import { mapFirebaseError } from '../lib/firebaseErrorMap'
//   const msg = mapFirebaseError(err, t)   // returns translated string
// ─────────────────────────────────────────────────────────────────────────────

import type { TFunction } from 'i18next'

/**
 * Maps a Firebase HttpsError code to an i18n key in the `errors` namespace.
 * Falls back to the error message text, then a generic fallback.
 */
export function mapFirebaseError(
  err: unknown,
  t: TFunction,
): string {
  if (!err || typeof err !== 'object') return t('common.error')

  const e = err as { code?: string; message?: string }

  // ── Map by HttpsError code ─────────────────────────────────────────────────
  switch (e.code) {
    case 'functions/unauthenticated':
    case 'auth/not-authenticated':
      return t('errors.unauthenticated', { defaultValue: t('common.error') })

    case 'functions/permission-denied':
      return t('errors.permissionDenied', { defaultValue: t('common.error') })

    case 'functions/not-found':
      return t('errors.notFound', { defaultValue: t('common.error') })

    case 'functions/resource-exhausted':
      return t('errors.rateLimitExceeded', { defaultValue: t('common.error') })

    case 'functions/failed-precondition':
      // May carry a user-facing message — try to match known patterns first
      break

    case 'functions/invalid-argument':
      return t('errors.invalidAmount', { defaultValue: t('common.error') })

    case 'functions/internal':
      return t('common.error')
  }

  // ── Map by error message string (backend error codes like ORD_001) ─────────
  const msg = e.message ?? ''

  if (msg.includes('PAY_') || msg.includes('Insufficient balance'))
    return t('errors.insufficientBalance')

  if (msg.includes('invalid amount') || msg.includes('Invalid amount'))
    return t('errors.invalidAmount')

  if (msg.includes('invalid price') || msg.includes('Invalid price'))
    return t('errors.invalidPrice')

  if (msg.includes('Rate limit') || msg.includes('Retry after'))
    return t('errors.rateLimitExceeded', { defaultValue: t('common.error') })

  if (msg.includes('KYC') || msg.includes('kyc'))
    return t('errors.kycRequired')

  if (msg.includes('minimum payout') || msg.includes('Minimum payout'))
    return t('errors.minPayout')

  if (msg.includes('upload') || msg.includes('Upload'))
    return t('errors.uploadFailed')

  if (msg.includes('password') || msg.includes('Password'))
    return t('errors.passwordTooShort')

  if (msg.includes('phone') || msg.includes('Phone'))
    return t('errors.invalidPhone')

  if (msg.includes('email') || msg.includes('Email'))
    return t('errors.invalidEmail')

  if (msg.includes('duration') || msg.includes('Duration'))
    return t('errors.invalidDuration')

  if (msg.includes('name') && msg.includes('short'))
    return t('errors.nameTooShort')

  // ── Generic fallback ───────────────────────────────────────────────────────
  return t('common.error')
}
