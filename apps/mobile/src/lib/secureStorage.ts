// ─────────────────────────────────────────────────────────────────────────────
// Secure Storage — expo-secure-store wrapper
//
// ALL sensitive values (auth tokens, payment tokens, session metadata) MUST
// go through this module.  Never use AsyncStorage for anything secret.
//
// expo-secure-store uses:
//   iOS  → Keychain Services (AES-256, hardware-backed on A12+)
//   Android → Android Keystore (TEE / StrongBox where available)
//
// Non-sensitive preferences (language, theme, onboarding state) may continue
// to use AsyncStorage — they are not routed here.
// ─────────────────────────────────────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

// ── Key registry (prevents typos / collisions) ────────────────────────────────

export const SECURE_KEYS = {
  // Firebase ID token cache (short-lived; Firebase SDK manages rotation)
  FIREBASE_ID_TOKEN:       'wf_firebase_id_token',
  // Tap Payments tokenized card reference (never store raw card data)
  TAP_PAYMENT_TOKEN:       'wf_tap_payment_token',
  // Biometric unlock opt-in flag
  BIOMETRIC_ENABLED:       'wf_biometric_enabled',
  // App Check debug token (dev builds only)
  APP_CHECK_DEBUG_TOKEN:   'wf_app_check_debug',
  // FCM registration token (sensitive: tied to device identity)
  FCM_TOKEN:               'wf_fcm_token',
} as const

export type SecureKey = typeof SECURE_KEYS[keyof typeof SECURE_KEYS]

// ── Options ───────────────────────────────────────────────────────────────────

/**
 * Require biometric authentication before reading the value on supported
 * devices.  Use for the highest-sensitivity keys (payment tokens).
 */
const BIOMETRIC_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt:  'Authenticate to continue',
}

const DEFAULT_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: false,
  keychainAccessible:
    SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

// ── Low-level wrappers ────────────────────────────────────────────────────────

/**
 * Store a value securely.
 * @param key     One of SECURE_KEYS
 * @param value   String value to store (serialize objects with JSON.stringify)
 * @param biometric  Require biometric authentication on read (default false)
 */
export async function secureSet(
  key: SecureKey,
  value: string,
  biometric = false,
): Promise<void> {
  const opts = biometric ? BIOMETRIC_OPTIONS : DEFAULT_OPTIONS
  await SecureStore.setItemAsync(key, value, opts)
}

/**
 * Read a value from secure storage.
 * Returns null if key does not exist or device does not support SecureStore.
 */
export async function secureGet(
  key: SecureKey,
  biometric = false,
): Promise<string | null> {
  if (!isSecureStoreAvailable()) return null
  try {
    const opts = biometric ? BIOMETRIC_OPTIONS : DEFAULT_OPTIONS
    return await SecureStore.getItemAsync(key, opts)
  } catch {
    // User cancelled biometric, item missing, or hardware error — treat as null
    return null
  }
}

/**
 * Delete a value from secure storage.
 */
export async function secureDelete(key: SecureKey): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key)
  } catch {
    // Key may not exist — not an error
  }
}

/**
 * Wipe all known secure keys (call on sign-out).
 */
export async function secureClearAll(): Promise<void> {
  await Promise.allSettled(
    Object.values(SECURE_KEYS).map(k => SecureStore.deleteItemAsync(k))
  )
}

// ── Typed helpers ─────────────────────────────────────────────────────────────

/** Store serialised JSON object securely. */
export async function secureSetJSON<T>(key: SecureKey, value: T): Promise<void> {
  await secureSet(key, JSON.stringify(value))
}

/** Read and parse a JSON object from secure storage. */
export async function secureGetJSON<T>(key: SecureKey): Promise<T | null> {
  const raw = await secureGet(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// ── Platform availability check ────────────────────────────────────────────────

/**
 * expo-secure-store requires a physical or simulator device.
 * It is NOT available in the Expo Go app on web.
 */
export function isSecureStoreAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android'
}

// ── AsyncStorage migration helper ─────────────────────────────────────────────

/**
 * One-time migration: move a value from AsyncStorage to SecureStore, then
 * delete the AsyncStorage entry.  Call once per key after app upgrade.
 *
 * @param asyncKey   The AsyncStorage key that held the value
 * @param secureKey  The destination SECURE_KEYS entry
 */
export async function migrateFromAsyncStorage(
  asyncKey: string,
  secureKey: SecureKey,
): Promise<void> {
  if (!isSecureStoreAvailable()) return
  try {
    const { default: AsyncStorage } = await import(
      '@react-native-async-storage/async-storage'
    )
    const value = await AsyncStorage.getItem(asyncKey)
    if (value !== null) {
      await secureSet(secureKey, value)
      await AsyncStorage.removeItem(asyncKey)
    }
  } catch {
    // Migration failure is non-fatal; user re-authenticates on next launch
  }
}
