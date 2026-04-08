// ─────────────────────────────────────────────────────────────────────────────
// Firebase client SDK — initialized once, exported as singletons
//
// Cold start : initializeApp + initializeAuth (registers auth component)
// Hot reload : getApp + getAuth            (reuses already-registered auth)
//
// Metro's `react-native` resolver condition (set in metro.config.js) ensures
// @firebase/auth/dist/rn/index.js is loaded; that bundle calls registerAuth()
// as a side effect so the auth component is always registered before we touch it.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp }                    from 'firebase/app'
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth'
import AsyncStorage                                           from '@react-native-async-storage/async-storage'
import {
  initializeFirestore, getFirestore,
  persistentLocalCache, CACHE_SIZE_UNLIMITED,
}                                                            from 'firebase/firestore'
import { getStorage }                                        from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator }            from 'firebase/functions'
import { getFirebaseConfig }                                 from '@workfix/config'

// ── App ───────────────────────────────────────────────────────────────────────

const isNewApp = getApps().length === 0
const app      = isNewApp
  ? initializeApp(getFirebaseConfig())
  : getApp()

// ── Auth ──────────────────────────────────────────────────────────────────────
// initializeAuth (with AsyncStorage persistence) must be called once on cold
// start. On hot reload the auth instance is already registered — getAuth() is
// the correct call in that case.

export const firebaseAuth = isNewApp
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app)

// ── Firestore ─────────────────────────────────────────────────────────────────
// persistentLocalCache requires native SQLite — not available in Expo Go.
// Fall back to default (memory) cache so the module never throws.

function getOrInitFirestore() {
  if (!isNewApp) return getFirestore(app)
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
    })
  } catch {
    return initializeFirestore(app, {})
  }
}

export const firestore = getOrInitFirestore()

// ── Storage & Functions ───────────────────────────────────────────────────────

export const firebaseStorage   = getStorage(app)
export const firebaseFunctions = getFunctions(app, 'me-central1')

// ── Emulator connections (development only) ───────────────────────────────────
// Guarded by a globalThis flag — idempotent across hot-reloads.
if (__DEV__ && process.env['EXPO_PUBLIC_USE_EMULATOR'] === 'true') {
  if (!(globalThis as Record<string, unknown>)['__emulatorsConnected']) {
    (globalThis as Record<string, unknown>)['__emulatorsConnected'] = true
    const HOST = 'localhost'

    connectFunctionsEmulator(firebaseFunctions, HOST, 5001)

    const { connectFirestoreEmulator } = require('firebase/firestore') as typeof import('firebase/firestore')
    connectFirestoreEmulator(firestore, HOST, 8080)

    const { connectAuthEmulator } = require('firebase/auth') as typeof import('firebase/auth')
    connectAuthEmulator(firebaseAuth, `http://${HOST}:9099`, { disableWarnings: true })

    const { connectStorageEmulator } = require('firebase/storage') as typeof import('firebase/storage')
    connectStorageEmulator(firebaseStorage, HOST, 9199)

    if (__DEV__) console.info('🔥 Firebase Emulators connected')
  }
}

// ── Backward-compat exports ───────────────────────────────────────────────────

export const FIREBASE_CONFIGURED = true
export { app as firebaseApp }
