// ─────────────────────────────────────────────────────────────────────────────
// @workfix/config — Firebase configuration
// Reads from environment variables — never hardcode keys here
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

/**
 * Returns Firebase config from environment variables.
 * Works in: Expo (process.env.EXPO_PUBLIC_*), Node (process.env.*)
 */
export function getFirebaseConfig(): FirebaseConfig {
  const measurementId =
    process.env['EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID'] ?? process.env['FIREBASE_MEASUREMENT_ID']

  const config: FirebaseConfig = {
    apiKey:            process.env['EXPO_PUBLIC_FIREBASE_API_KEY'] ?? process.env['FIREBASE_API_KEY'] ?? '',
    authDomain:        process.env['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'] ?? process.env['FIREBASE_AUTH_DOMAIN'] ?? '',
    projectId:         process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] ?? process.env['FIREBASE_PROJECT_ID'] ?? '',
    storageBucket:     process.env['EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'] ?? process.env['FIREBASE_STORAGE_BUCKET'] ?? '',
    messagingSenderId: process.env['EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] ?? process.env['FIREBASE_MESSAGING_SENDER_ID'] ?? '',
    appId:             process.env['EXPO_PUBLIC_FIREBASE_APP_ID'] ?? process.env['FIREBASE_APP_ID'] ?? '',
    ...(measurementId !== undefined && { measurementId }),
  }

  if (!config.projectId) {
    throw new Error(
      '[WorkFix] Firebase projectId is missing. ' +
      'Make sure .env is configured correctly. See .env.example',
    )
  }

  return config
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
