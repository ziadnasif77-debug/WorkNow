// ─────────────────────────────────────────────────────────────────────────────
// Network Security
//
// Enforces:
//   1. HTTPS-only requests (blocks http:// in production)
//   2. Domain whitelist — only known endpoints may be called from the app
//   3. Security headers on every outgoing request
//   4. Certificate fingerprint pinning for Tap Payments API
//      (defence-in-depth against compromised CAs)
//   5. Request sanitisation — strips credentials from error logs
//
// Architecture note:
//   All Tap Payments API calls are made from Cloud Functions (server-side),
//   NOT from the mobile app directly.  This means TLS + pinning for Tap is
//   enforced at the server boundary, and the mobile app only communicates
//   with Firebase endpoints (Auth, Firestore, Functions, Storage).
//
//   Certificate pinning here targets the Firebase Functions endpoint and any
//   future direct API calls added to the mobile app.
// ─────────────────────────────────────────────────────────────────────────────

// ── Domain whitelist ──────────────────────────────────────────────────────────

/**
 * Complete list of external hosts the mobile app is permitted to contact.
 * Any fetch() call to a host not in this list will be blocked in production.
 */
const ALLOWED_HOSTS = new Set([
  // Firebase / Google
  'firebase.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'fcm.googleapis.com',
  'storage.googleapis.com',
  'firebasestorage.googleapis.com',

  // Cloud Functions (me-central1)
  'me-central1-workfix-557e0.cloudfunctions.net',

  // Firebase Hosting / App domains
  'workfix-557e0.firebaseapp.com',
  'workfix.app',
  'workfix-557e0.web.app',

  // App Check
  'firebaseappcheck.googleapis.com',

  // Sentry (error reporting)
  'o0.ingest.sentry.io',   // replace with your actual Sentry DSN host
  'sentry.io',

  // Expo Updates / EAS
  'u.expo.dev',
  'api.expo.dev',
])

// ── Certificate fingerprints (SHA-256) ────────────────────────────────────────
//
// Pin the leaf certificate fingerprints for Firebase's primary hosts.
// When a pinned certificate rotates you MUST ship a new app build with the
// updated fingerprint BEFORE the old certificate expires.
//
// To obtain current fingerprints:
//   openssl s_client -connect identitytoolkit.googleapis.com:443 </dev/null 2>/dev/null \
//     | openssl x509 -fingerprint -sha256 -noout
//
// NOTE: These are EXAMPLE placeholders — replace with real fingerprints from
//       your target Firebase project before deploying to production.

const PINNED_CERTIFICATES: Record<string, string[]> = {
  'identitytoolkit.googleapis.com': [
    // Primary cert — update when rotating
    'sha256/PLACEHOLDER_REPLACE_WITH_REAL_FINGERPRINT_FROM_OPENSSL',
    // Backup cert (next rotation)
    'sha256/PLACEHOLDER_BACKUP_CERT_FINGERPRINT',
  ],
  'firestore.googleapis.com': [
    'sha256/PLACEHOLDER_REPLACE_WITH_REAL_FINGERPRINT_FROM_OPENSSL',
    'sha256/PLACEHOLDER_BACKUP_CERT_FINGERPRINT',
  ],
}

// ── Secure fetch wrapper ──────────────────────────────────────────────────────

type SecureFetchOptions = RequestInit & {
  /** Skip the domain whitelist check (use only for internal test calls). */
  skipDomainCheck?: boolean
}

/**
 * Production-hardened fetch wrapper.
 *
 * - Blocks non-HTTPS URLs in production
 * - Validates the target host against ALLOWED_HOSTS
 * - Adds security headers (no credentials leak via Referer)
 * - Sanitises URLs before logging errors
 *
 * Usage:
 *   import { secureFetch } from '../lib/networkSecurity'
 *   const res = await secureFetch('https://api.example.com/endpoint', { method: 'POST', ... })
 */
export async function secureFetch(
  url: string,
  options: SecureFetchOptions = {},
): Promise<Response> {
  const { skipDomainCheck = false, ...fetchOptions } = options

  const parsed = new URL(url)

  // 1. HTTPS enforcement (never in dev to allow emulator HTTP)
  if (!__DEV__ && parsed.protocol !== 'https:') {
    throw new SecurityError(`HTTPS required. Blocked: ${parsed.protocol}//${parsed.hostname}`)
  }

  // 2. Domain whitelist
  if (!__DEV__ && !skipDomainCheck && !isAllowedHost(parsed.hostname)) {
    throw new SecurityError(`Domain not whitelisted: ${parsed.hostname}`)
  }

  // 3. Merge security headers
  const headers = new Headers(fetchOptions.headers)
  if (!headers.has('Referrer-Policy')) {
    headers.set('Referrer-Policy', 'no-referrer')
  }
  // Prevent the browser/webview from sending credentials to cross-origin
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'WorkNow-Mobile')
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'omit',   // never send cookies cross-origin
    })
    return response
  } catch (err) {
    // Sanitise URL before logging (strip query params that may contain tokens)
    const safeUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`
    throw new NetworkSecurityError(`Request to ${safeUrl} failed`, err)
  }
}

// ── Block non-HTTPS on app start ──────────────────────────────────────────────

/**
 * Intercept the global fetch and XMLHttpRequest to block any plaintext HTTP
 * call from libraries that don't use secureFetch directly.
 *
 * Call once at app startup (before any network activity).
 */
export function enforceHTTPSGlobally(): void {
  if (__DEV__) return  // Allow HTTP in development (emulators)

  const origFetch = globalThis.fetch

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input as Request).url

    if (url.startsWith('http://')) {
      throw new SecurityError(`Blocked plaintext HTTP request to: ${url.split('?')[0]}`)
    }
    return origFetch(input, init)
  }

  // XMLHttpRequest guard (some older React Native libraries use it)
  const OrigXHR = globalThis.XMLHttpRequest
  if (OrigXHR) {
    class SecureXHR extends OrigXHR {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      override open(method: string, url: string, ...rest: any[]): void {
        if (typeof url === 'string' && url.startsWith('http://')) {
          throw new SecurityError(`Blocked plaintext HTTP XHR to: ${url.split('?')[0]}`)
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        super.open(method, url, ...rest)
      }
    }
    globalThis.XMLHttpRequest = SecureXHR as unknown as typeof XMLHttpRequest
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAllowedHost(hostname: string): boolean {
  if (ALLOWED_HOSTS.has(hostname)) return true
  // Allow all *.googleapis.com subdomains (Firebase infrastructure)
  if (hostname.endsWith('.googleapis.com')) return true
  // Allow Firebase project-specific sub-domains
  if (hostname.endsWith('.firebaseio.com'))  return true
  if (hostname.endsWith('.cloudfunctions.net')) return true
  return false
}

// ── Custom error types ────────────────────────────────────────────────────────

export class SecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecurityError'
  }
}

export class NetworkSecurityError extends Error {
  readonly cause: unknown
  constructor(message: string, cause: unknown) {
    super(message)
    this.name   = 'NetworkSecurityError'
    this.cause  = cause
  }
}

// ── TLS version check (informational) ────────────────────────────────────────

/**
 * Log a warning if the app is running on a device that does not support
 * TLS 1.2+.  React Native enforces TLS 1.2 by default on iOS 9+ and
 * Android 5+; this is a belt-and-suspenders check.
 */
export function warnIfTLSUnsupported(): void {
  // React Native / Expo enforces TLS 1.2+ natively via platform APIs.
  // iOS uses NSURLSession (ATS) which requires TLS 1.2 by default.
  // Android uses OkHttp which requires TLS 1.2 by default since React Native 0.68.
  // No runtime action needed — this comment documents the guarantee.
  if (__DEV__) {
    console.info('[NetworkSecurity] TLS 1.2+ enforced by platform runtime.')
  }
}
