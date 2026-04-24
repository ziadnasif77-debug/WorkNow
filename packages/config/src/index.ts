// ─────────────────────────────────────────────────────────────────────────────
// @workfix/config — Firebase configuration
//
// Priority order:
//   1. EXPO_PUBLIC_* / FIREBASE_* environment variables  (CI, local .env)
//   2. Hardcoded fallback for workfix-557e0              (Expo Go without .env)
//
// Firebase web credentials are public-facing (embedded in every web bundle)
// and are safe to ship in source code. Security is enforced by Firestore Rules
// and Firebase Auth — not by keeping the API key secret.
// ─────────────────────────────────────────────────────────────────────────────

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId?: string
}

/** Placeholder strings written by .env.example — treated as "not configured" */
const PLACEHOLDERS = new Set([
  'your_api_key_here',
  'your_project_id',
  'your_project.firebaseapp.com',
  'your_project.appspot.com',
  '123456789',
  '1:123456789:web:abcdef',
])

/**
 * Hardcoded fallback for workfix-557e0.
 * Used when EXPO_PUBLIC_* vars are absent (e.g. Expo Go before `--clear`).
 */
const FALLBACK_CONFIG: FirebaseConfig = {
  apiKey:            'AIzaSyDOMk1zDMiGFZ5msM9OQK9q9BQertTGPOI',
  authDomain:        'workfix-557e0.firebaseapp.com',
  projectId:         'workfix-557e0',
  storageBucket:     'workfix-557e0.firebasestorage.app',
  messagingSenderId: '583344787316',
  appId:             '1:583344787316:web:eed052be0143a142fea621',
  measurementId:     'G-723L9SEVEL',
}

/**
 * Returns Firebase config.
 * Reads env vars first; falls back to the hardcoded project config.
 */
export function getFirebaseConfig(): FirebaseConfig {
  const envProjectId =
    process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] ?? process.env['FIREBASE_PROJECT_ID'] ?? ''

  // If env vars are present and not placeholders, use them
  if (envProjectId && !PLACEHOLDERS.has(envProjectId)) {
    const measurementId =
      process.env['EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID'] ?? process.env['FIREBASE_MEASUREMENT_ID']
    return {
      apiKey:            process.env['EXPO_PUBLIC_FIREBASE_API_KEY'] ?? process.env['FIREBASE_API_KEY'] ?? FALLBACK_CONFIG.apiKey,
      authDomain:        process.env['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'] ?? process.env['FIREBASE_AUTH_DOMAIN'] ?? FALLBACK_CONFIG.authDomain,
      projectId:         envProjectId,
      storageBucket:     process.env['EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'] ?? process.env['FIREBASE_STORAGE_BUCKET'] ?? FALLBACK_CONFIG.storageBucket,
      messagingSenderId: process.env['EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] ?? process.env['FIREBASE_MESSAGING_SENDER_ID'] ?? FALLBACK_CONFIG.messagingSenderId,
      appId:             process.env['EXPO_PUBLIC_FIREBASE_APP_ID'] ?? process.env['FIREBASE_APP_ID'] ?? FALLBACK_CONFIG.appId,
      ...(measurementId !== undefined && !PLACEHOLDERS.has(measurementId) && { measurementId }),
    }
  }

  // Fall back to hardcoded config so the app boots in Expo Go without .env
  console.info('[WorkFix] Using built-in Firebase config (workfix-557e0)')
  return FALLBACK_CONFIG
}

/** Always true — the fallback config ensures Firebase is always available. */
export function isFirebaseConfigured(): boolean {
  return true
}

/** Feature flag keys (used with Firebase Remote Config) */
export const FEATURE_FLAGS = {
  SUBSCRIPTIONS_ENABLED:  'subscriptions_enabled',
  BOOST_ENABLED:          'boost_enabled',
  DISPUTES_ENABLED:       'disputes_enabled',
  CASH_PAYMENT_ENABLED:   'cash_payment_enabled',
  AGENCY_MODEL_ENABLED:   'agency_model_enabled',
  NORWAY_MARKET_ENABLED:  'norway_market_enabled',
  SWEDEN_MARKET_ENABLED:  'sweden_market_enabled',
} as const

export type FeatureFlag = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS]

/** Default commission rate (12%) — override via Remote Config */
export const DEFAULT_COMMISSION_RATE = 0.12

/** Quote expiry duration in hours */
export const QUOTE_EXPIRY_HOURS = 24

/** Escrow auto-release after provider completes (hours) */
export const ESCROW_AUTO_RELEASE_HOURS = 48

/** Geohash precision for provider search (6 ≈ 1.2km) */
export const GEO_PRECISION = 6

/** Default search radius in km */
export const DEFAULT_SEARCH_RADIUS_KM = 20

/** Pagination defaults */
export const PAGE_SIZE = 20

/** Max quotes allowed per order before it's closed to new bids */
export const MAX_QUOTES_PER_ORDER = 8

/** Ranking weights for provider search scoring */
export const RANK_WEIGHTS = {
  distance:   0.35,
  rating:     0.30,
  experience: 0.20,
  reputation: 0.15,
} as const

/** New-provider cold-start bonus (added to rank score until 10 completed orders) */
export const NEW_PROVIDER_BOOST = 0.08
