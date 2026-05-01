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
import { initAppCheck }                                      from './appCheck'
import type { connectFirestoreEmulator as ConnectFirestoreEmulatorFn } from 'firebase/firestore'
import type { connectAuthEmulator as ConnectAuthEmulatorFn } from 'firebase/auth'
import type { connectStorageEmulator as ConnectStorageEmulatorFn } from 'firebase/storage'

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

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { connectFirestoreEmulator } = require('firebase/firestore') as { connectFirestoreEmulator: typeof ConnectFirestoreEmulatorFn }
    connectFirestoreEmulator(firestore, HOST, 8080)

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { connectAuthEmulator } = require('firebase/auth') as { connectAuthEmulator: typeof ConnectAuthEmulatorFn }
    connectAuthEmulator(firebaseAuth, `http://${HOST}:9099`, { disableWarnings: true })

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { connectStorageEmulator } = require('firebase/storage') as { connectStorageEmulator: typeof ConnectStorageEmulatorFn }
    connectStorageEmulator(firebaseStorage, HOST, 9199)

    if (__DEV__) console.info('🔥 Firebase Emulators connected')
  }
}

// ── App Check — must be initialised after the app instance is ready ──────────
// App Check attaches a token to every Firebase request, proving this is a
// genuine WorkNow binary running on an unmodified device.
// initAppCheck() is idempotent — safe to call on hot reloads.
if (isNewApp) {
  void initAppCheck()
}

// ── Backward-compat exports ───────────────────────────────────────────────────

export const FIREBASE_CONFIGURED = true
export { app as firebaseApp }
