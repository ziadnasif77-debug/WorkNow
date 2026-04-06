// ─────────────────────────────────────────────────────────────────────────────
// Firebase client SDK — initialized once, exported as singletons
//
// Initialization order (MUST be respected — do NOT reorder):
//   1. initializeApp     → creates the Firebase app
//   2. getOrInitAuth     → registers the Auth component with RN persistence
//   3. getOrInitFirestore→ initialises Firestore with offline cache
//   4. Storage / Functions
//
// Hot-reload safe: both App and Auth are guarded against double-init.
// Expo Go / web safe: persistence falls back to inMemoryPersistence when the
//   @react-native-async-storage native module is unavailable.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp }   from 'firebase/app'
import {
  initializeAuth,
  getAuth,
  inMemoryPersistence,
}                                            from 'firebase/auth'
import type { Persistence }                  from 'firebase/auth'
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  CACHE_SIZE_UNLIMITED,
}                                            from 'firebase/firestore'
import { getStorage }                        from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { Platform }                          from 'react-native'
import { getFirebaseConfig }                 from '@workfix/config'

// ── Config ────────────────────────────────────────────────────────────────────

const firebaseConfig = getFirebaseConfig()

// ── App singleton (step 1) ────────────────────────────────────────────────────
// getApps() returns [] on first load and [app] on hot-reload.

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp()

// ── Auth persistence helper ───────────────────────────────────────────────────
// • Native (iOS/Android): AsyncStorage keeps the user logged in between restarts.
// • Web / Expo Go without native module: inMemoryPersistence — session resets on
//   reload, but the app loads cleanly without crashing.

function buildPersistence(): Persistence {
  if (Platform.OS === 'web') return inMemoryPersistence

  try {
    // getReactNativePersistence is not in the public TS types but IS exported
    // from firebase/auth at runtime via Metro's React Native resolver.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReactNativePersistence } = require('firebase/auth') as {
      getReactNativePersistence: (storage: unknown) => Persistence
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage') as {
      default?: unknown; [k: string]: unknown
    }
    // Handle both CJS default export and ESM default
    const AsyncStorage = mod['default'] ?? mod
    return getReactNativePersistence(AsyncStorage)
  } catch {
    // Native module unavailable (Expo Go on first install, web bundler) →
    // fall back gracefully; users will need to re-authenticate after each restart.
    if (__DEV__) console.warn('[Firebase] AsyncStorage unavailable — using inMemoryPersistence')
    return inMemoryPersistence
  }
}

// ── Auth singleton (step 2) ───────────────────────────────────────────────────
// RULE: initializeAuth MUST be called before ANY getAuth() call.
//       On hot-reload, initializeAuth throws 'auth/already-initialized' →
//       only then is it safe to call getAuth(app).
//       Any OTHER error from initializeAuth is re-thrown so it is visible.

function getOrInitAuth() {
  try {
    return initializeAuth(app, { persistence: buildPersistence() })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/already-initialized') {
      // Hot-reload: auth was properly initialized in the previous module load.
      return getAuth(app)
    }
    // Unknown error — rethrow with context so it is visible in the red screen
    console.error('[Firebase] initializeAuth failed:', err)
    throw err
  }
}

export const firebaseAuth = getOrInitAuth()

// ── Firestore with offline persistence (step 3) ───────────────────────────────
// initializeFirestore also throws on double-init; guard identically.

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

// ── Storage (step 4) ──────────────────────────────────────────────────────────

export const firebaseStorage = getStorage(app)

// ── Cloud Functions — MENA region (step 4) ────────────────────────────────────

export const firebaseFunctions = getFunctions(app, 'me-central1')

// ── Emulator connections (dev only) ───────────────────────────────────────────
// connectXxxEmulator calls are idempotent only if called once per process.
// A module-level flag prevents duplicate connections on hot-reload.

if (__DEV__ && process.env['EXPO_PUBLIC_USE_EMULATOR'] === 'true') {
  if (!(globalThis as Record<string, unknown>)['__emulatorsConnected']) {
    ;(globalThis as Record<string, unknown>)['__emulatorsConnected'] = true
    const HOST = 'localhost'

    connectFunctionsEmulator(firebaseFunctions, HOST, 5001)

    // Dynamic requires avoid bundling emulator code in production
    const { connectFirestoreEmulator } =
      require('firebase/firestore') as typeof import('firebase/firestore')
    connectFirestoreEmulator(firestore, HOST, 8080)

    const { connectAuthEmulator } =
      require('firebase/auth') as typeof import('firebase/auth')
    connectAuthEmulator(firebaseAuth, `http://${HOST}:9099`, { disableWarnings: true })

    const { connectStorageEmulator } =
      require('firebase/storage') as typeof import('firebase/storage')
    connectStorageEmulator(firebaseStorage, HOST, 9199)

    if (__DEV__) console.info('[Firebase] Emulators connected')
  }
}

export { app as firebaseApp }
