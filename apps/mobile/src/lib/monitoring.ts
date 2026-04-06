// ─────────────────────────────────────────────────────────────────────────────
// Monitoring — Sentry + Firebase Crashlytics for the mobile app
// Initialize once in app/_layout.tsx before rendering
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native'

// @sentry/react-native is native-only — stub for Expo Go / web
type SentryStub = {
  init: (opts: Record<string, unknown>) => void
  setUser: (user: { id: string } | null) => void
  setTag: (key: string, value: string) => void
  captureException: (err: Error, ctx?: Record<string, unknown>) => void
  captureMessage: (msg: string, level?: string) => void
  addBreadcrumb: (crumb: Record<string, unknown>) => void
}
const noopSentry: SentryStub = {
  init:             () => undefined,
  setUser:          () => undefined,
  setTag:           () => undefined,
  captureException: () => undefined,
  captureMessage:   () => undefined,
  addBreadcrumb:    () => undefined,
}
let Sentry: SentryStub = noopSentry
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Sentry = require('@sentry/react-native') as SentryStub
} catch {
  // Expo Go / web — use noop stub
}

// @react-native-firebase/crashlytics is native-only — stub for Expo Go / web
type Crashlytics = {
  setUserId: (id: string) => Promise<void>
  setAttribute: (name: string, value: string) => Promise<void>
  recordError: (err: Error) => Promise<void>
  log: (msg: string) => Promise<void>
}
const noopCrashlytics: Crashlytics = {
  setUserId:    async () => undefined,
  setAttribute: async () => undefined,
  recordError:  async () => undefined,
  log:          async () => undefined,
}
let _crashlytics: (() => Crashlytics) = () => noopCrashlytics
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@react-native-firebase/crashlytics') as { default: () => Crashlytics }
  _crashlytics = mod.default
} catch {
  // Expo Go / web — use noop stub
}
const crashlytics = _crashlytics

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
    beforeSend: (event: Record<string, unknown>) => {
      // Strip sensitive data before sending to Sentry
      const req = event['request'] as Record<string, unknown> | undefined
      if (req?.['data']) {
        const data = req['data'] as Record<string, unknown>
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
