// ─────────────────────────────────────────────────────────────────────────────
// Firebase client SDK — initialized once, exported as singletons
// Hot-reload safe: both App and Auth guarded against double-init
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  initializeAuth,
  getAuth,
} from 'firebase/auth'
// getReactNativePersistence is a React-Native-only export — not in firebase/auth typings
// but available at runtime via Metro's react-native resolver
import type { Persistence } from 'firebase/auth'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: unknown) => Persistence
}
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  CACHE_SIZE_UNLIMITED,
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'
import { getFirebaseConfig } from '@workfix/config'

const firebaseConfig = getFirebaseConfig()

// ── App singleton ──────────────────────────────────────────────────────────────
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp()

// ── Auth singleton (hot-reload safe) ──────────────────────────────────────────
// initializeAuth throws "already initialized" on hot-reload — guard with getAuth
function getOrInitAuth() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    })
  } catch {
    // Already initialized — return existing instance
    return getAuth(app)
  }
}
export const firebaseAuth = getOrInitAuth()

// ── Firestore with offline persistence ────────────────────────────────────────
// initializeFirestore also throws on duplicate init; guard the same way
function getOrInitFirestore() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
    })
  } catch {
    return getFirestore(app)
  }
}
export const firestore = getOrInitFirestore()

// ── Storage ───────────────────────────────────────────────────────────────────
export const firebaseStorage = getStorage(app)

// ── Cloud Functions (MENA region) ─────────────────────────────────────────────
export const firebaseFunctions = getFunctions(app, 'me-central1')

// ── Connect to emulators in development ───────────────────────────────────────
// Emulator connections are idempotent — safe to call every time in dev
if (__DEV__ && process.env['EXPO_PUBLIC_USE_EMULATOR'] === 'true') {
  const HOST = 'localhost'

  // Use a module-level flag to prevent multiple connections on hot-reload
  if (!(globalThis as Record<string, unknown>)['__emulatorsConnected']) {
    (globalThis as Record<string, unknown>)['__emulatorsConnected'] = true

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

export { app as firebaseApp }
