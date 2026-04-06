// ─────────────────────────────────────────────────────────────────────────────
// Firebase client SDK — initialized once, exported as singletons
//
// Design goals:
//   • NEVER throw at module level — a crash here kills every Expo Router route.
//   • Detect missing / placeholder credentials and export FIREBASE_CONFIGURED=false
//     so _layout.tsx can show a "Configuration Missing" screen instead of RSOD.
//   • Hot-reload safe: all singletons guarded against double-init.
//   • Expo Go / web safe: AsyncStorage persistence falls back to inMemoryPersistence.
//
// Initialization order (DO NOT reorder):
//   1. initializeApp     → creates the Firebase app instance
//   2. getOrInitAuth     → registers Auth BEFORE any getAuth() call (SDK rule)
//   3. getOrInitFirestore→ sets up Firestore with offline cache
//   4. Storage / Functions
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp }          from 'firebase/app'
import { initializeAuth, getAuth, inMemoryPersistence } from 'firebase/auth'
import type { Persistence, Auth }                   from 'firebase/auth'
import {
  initializeFirestore, getFirestore,
  persistentLocalCache, CACHE_SIZE_UNLIMITED,
}                                                   from 'firebase/firestore'
import type { Firestore }                           from 'firebase/firestore'
import { getStorage }                               from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator }   from 'firebase/functions'
import { Platform }                                 from 'react-native'
import { getFirebaseConfig, isFirebaseConfigured }  from '@workfix/config'

// ── Config ─────────────────────────────────────────────────────────────────────

/**
 * True when real Firebase credentials are present.
 * _layout.tsx reads this to show a "Configuration Missing" screen instead of
 * crashing when the developer hasn't filled in their .env yet.
 */
export const FIREBASE_CONFIGURED = isFirebaseConfigured()

const firebaseConfig = getFirebaseConfig()   // safe — never throws

// ── Step 1: App singleton ──────────────────────────────────────────────────────

const app = (() => {
  try {
    return getApps().length === 0
      ? initializeApp(firebaseConfig)
      : getApp()
  } catch (err) {
    console.error('[Firebase] initializeApp failed:', err)
    // Return existing app if one exists; otherwise we cannot proceed
    if (getApps().length > 0) return getApp()
    throw err
  }
})()

// ── Step 2a: Auth persistence ──────────────────────────────────────────────────
// Native → AsyncStorage (survives restarts).
// Web / Expo Go (no native module) → inMemoryPersistence (session resets on reload).

function buildPersistence(): Persistence {
  if (Platform.OS === 'web') return inMemoryPersistence
  try {
    // getReactNativePersistence is not in TS types but IS exported at runtime
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReactNativePersistence } = require('firebase/auth') as {
      getReactNativePersistence: (storage: unknown) => Persistence
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage') as {
      default?: unknown; [k: string]: unknown
    }
    const AsyncStorage = mod['default'] ?? mod   // CJS vs ESM
    return getReactNativePersistence(AsyncStorage)
  } catch {
    if (__DEV__) console.warn('[Firebase] AsyncStorage unavailable → inMemoryPersistence')
    return inMemoryPersistence
  }
}

// ── Step 2b: Auth singleton ────────────────────────────────────────────────────
// Rules:
//   • Call initializeAuth BEFORE any getAuth().
//   • On hot-reload: initializeAuth throws 'auth/already-initialized' → use getAuth.
//   • Any OTHER error: retry with inMemoryPersistence as last resort.
//   • If everything fails: export a degraded stub so the rest of the module loads.

function getOrInitAuth(): Auth {
  // First attempt — full persistence
  try {
    return initializeAuth(app, { persistence: buildPersistence() })
  } catch (err) {
    const code    = (err as { code?: string }).code ?? ''
    const message = String((err as { message?: string }).message ?? '')

    // Hot-reload: auth is already registered, getAuth is safe
    if (code === 'auth/already-initialized' || message.toLowerCase().includes('already')) {
      return getAuth(app)
    }

    // Second attempt — simpler in-memory persistence
    if (__DEV__) console.warn('[Firebase] initializeAuth (attempt 1) failed:', message)
    try {
      return initializeAuth(app, { persistence: inMemoryPersistence })
    } catch (err2) {
      const code2 = (err2 as { code?: string }).code ?? ''
      const msg2  = String((err2 as { message?: string }).message ?? '')

      if (code2 === 'auth/already-initialized' || msg2.toLowerCase().includes('already')) {
        return getAuth(app)
      }

      // Absolute last resort — log clearly but do NOT throw (module must load)
      console.error('[Firebase] Auth initialization failed completely:', err2)
      // Return getAuth — it may throw "not registered" but that will be caught
      // by the ErrorBoundary in _layout.tsx rather than killing the module graph.
      return getAuth(app)
    }
  }
}

export const firebaseAuth = getOrInitAuth()

// ── Step 3: Firestore ──────────────────────────────────────────────────────────

function getOrInitFirestore(): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
    })
  } catch {
    return getFirestore(app)
  }
}

export const firestore = getOrInitFirestore()

// ── Step 4: Storage & Functions ────────────────────────────────────────────────

export const firebaseStorage  = getStorage(app)
export const firebaseFunctions = getFunctions(app, 'me-central1')

// ── Emulator connections (dev only) ───────────────────────────────────────────

if (__DEV__ && process.env['EXPO_PUBLIC_USE_EMULATOR'] === 'true') {
  if (!(globalThis as Record<string, unknown>)['__emulatorsConnected']) {
    ;(globalThis as Record<string, unknown>)['__emulatorsConnected'] = true
    const HOST = 'localhost'

    connectFunctionsEmulator(firebaseFunctions, HOST, 5001)

    const { connectFirestoreEmulator } =
      require('firebase/firestore') as typeof import('firebase/firestore')
    connectFirestoreEmulator(firestore, HOST, 8080)

    const { connectAuthEmulator } =
      require('firebase/auth') as typeof import('firebase/auth')
    connectAuthEmulator(firebaseAuth, `http://${HOST}:9099`, { disableWarnings: true })

    const { connectStorageEmulator } =
      require('firebase/storage') as typeof import('firebase/storage')
    connectStorageEmulator(firebaseStorage, HOST, 9199)

    console.info('[Firebase] Emulators connected')
  }
}

export { app as firebaseApp }
