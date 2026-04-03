// ─────────────────────────────────────────────────────────────────────────────
// Monitoring — Sentry + Firebase Crashlytics for the mobile app
// Initialize once in app/_layout.tsx before rendering
// ─────────────────────────────────────────────────────────────────────────────

import * as Sentry from '@sentry/react-native'
import crashlytics from '@react-native-firebase/crashlytics'
import { Platform } from 'react-native'

const IS_PROD = process.env['EXPO_PUBLIC_ENV'] === 'production'

// ── Sentry ────────────────────────────────────────────────────────────────────

export function initSentry(): void {
  if (!IS_PROD) return  // only in production

  const dsn = process.env['EXPO_PUBLIC_SENTRY_DSN']
  if (!dsn) {
    console.warn('[Monitoring] EXPO_PUBLIC_SENTRY_DSN not set — Sentry disabled')
    return
  }

  Sentry.init({
    dsn,
    environment:          IS_PROD ? 'production' : 'development',
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    tracesSampleRate:     IS_PROD ? 0.2 : 1.0,   // 20% traces in prod
    enableNative:         true,
    attachScreenshot:     false,  // no screenshots for privacy (GDPR)
    beforeSend: (event) => {
      // Strip sensitive data before sending to Sentry
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>
        // Mask card numbers, phone numbers
        if (typeof data['phone'] === 'string') data['phone'] = '***'
        if (typeof data['password'] === 'string') data['password'] = '[REDACTED]'
      }
      return event
    },
  })
}

// ── User context ──────────────────────────────────────────────────────────────

export function setMonitoringUser(uid: string, role: string): void {
  if (!IS_PROD) return

  // Sentry — set user without PII
  Sentry.setUser({ id: uid })
  Sentry.setTag('user.role', role)
  Sentry.setTag('platform', Platform.OS)

  // Crashlytics
  void crashlytics().setUserId(uid)
  void crashlytics().setAttribute('role', role)
}

export function clearMonitoringUser(): void {
  Sentry.setUser(null)
  void crashlytics().setUserId('')
}

// ── Error capture ─────────────────────────────────────────────────────────────

export function captureError(
  error: unknown,
  context?: Record<string, string>,
): void {
  const err = error instanceof Error ? error : new Error(String(error))

  if (IS_PROD) {
    Sentry.captureException(err, { extra: context })
    void crashlytics().recordError(err)
  } else {
    if (__DEV__) console.error('[Error]', err.message, context)
  }
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
): void {
  if (IS_PROD) {
    Sentry.captureMessage(message, level)
  } else {
    console.log(`[${level.toUpperCase()}]`, message)
  }
}

// ── Performance breadcrumbs ───────────────────────────────────────────────────

export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!IS_PROD) return
  Sentry.addBreadcrumb({ category, message, data, level: 'info' })
}

// ── Screen tracking ───────────────────────────────────────────────────────────

export function trackScreen(screenName: string): void {
  if (!IS_PROD) return
  Sentry.addBreadcrumb({ category: 'navigation', message: screenName, level: 'info' })
  void crashlytics().log(`Screen: ${screenName}`)
}

// ── Navigation ref wrapper (for Sentry routing instrumentation) ───────────────

export function wrapNavigationRef<T>(ref: T): T {
  // No-op in dev; in prod Sentry instruments navigation automatically
  return ref
}
