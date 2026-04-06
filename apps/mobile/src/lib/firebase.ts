// ─────────────────────────────────────────────────────────────────────────────
// Firebase client SDK — initialized once, exported as singletons
//
// CRITICAL DESIGN RULE:
//   When credentials are missing/placeholder, we export STUB objects and skip
//   all SDK initialization entirely. This prevents the cascade crash where an
//   empty apiKey causes initializeAuth to fail, leaving the auth provider in a
//   broken partial state that makes every subsequent call throw
//   "Component auth has not been registered yet" — which kills the whole module
//   graph and strips default exports from every Expo Router route.
//
//   _layout.tsx checks FIREBASE_CONFIGURED and shows ConfigMissingScreen before
//   any code touches the stubs, so the app loads cleanly with a clear message.
//
// Initialization order when credentials ARE present (DO NOT reorder):
//   1. initializeApp     → creates the Firebase app instance
//   2. getOrInitAuth     → registers Auth BEFORE any getAuth() call (SDK rule)
//   3. getOrInitFirestore→ sets up Firestore with offline cache
//   4. Storage / Functions
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp }            from 'firebase/app'
import type { FirebaseApp }                           from 'firebase/app'
import { initializeAuth, getAuth, inMemoryPersistence } from 'firebase/auth'
import type { Auth, Persistence }                     from 'firebase/auth'
import {
  initializeFirestore, getFirestore,
  persistentLocalCache, CACHE_SIZE_UNLIMITED,
}                                                     from 'firebase/firestore'
import type { Firestore }                             from 'firebase/firestore'
import type { FirebaseStorage }                       from 'firebase/storage'
import { getStorage }                                 from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator }     from 'firebase/functions'
import type { Functions }                             from 'firebase/functions'
import { Platform }                                   from 'react-native'
import { getFirebaseConfig, isFirebaseConfigured }    from '@workfix/config'

// ── Configuration check ───────────────────────────────────────────────────────

/**
 * True only when real Firebase credentials are present in the environment.
 * _layout.tsx reads this to show ConfigMissingScreen instead of crashing.
 */
export const FIREBASE_CONFIGURED: boolean = isFirebaseConfigured()

// ── Early-exit stubs ──────────────────────────────────────────────────────────
// When not configured we export typed stubs. They are NEVER called — _layout.tsx
// renders ConfigMissingScreen before any component mounts that would use them.
// Cast via `unknown` so TypeScript accepts them as the correct types.

if (!FIREBASE_CONFIGURED) {
  console.warn(
    '[Firebase] Credentials missing — exporting stubs.\n' +
    '  Fill in apps/mobile/.env and restart with: expo start --clear',
  )
}

const _stub = <T>(): T => ({}) as unknown as T

// ── Step 1: App ───────────────────────────────────────────────────────────────

function buildApp(): FirebaseApp {
  if (!FIREBASE_CONFIGURED) return _stub<FirebaseApp>()
  try {
    const cfg = getFirebaseConfig()
    return getApps().length === 0 ? initializeApp(cfg) : getApp()
  } catch (err) {
    console.error('[Firebase] initializeApp failed:', err)
    if (getApps().length > 0) return getApp()
    throw err
  }
}

const app = buildApp()

// ── Step 2a: Persistence ──────────────────────────────────────────────────────

function buildPersistence(): Persistence {
  if (Platform.OS === 'web') return inMemoryPersistence
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReactNativePersistence } = require('firebase/auth') as {
      getReactNativePersistence: (s: unknown) => Persistence
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage') as {
      default?: unknown; [k: string]: unknown
    }
    return getReactNativePersistence(mod['default'] ?? mod)
  } catch {
    if (__DEV__) console.warn('[Firebase] AsyncStorage unavailable → inMemoryPersistence')
    return inMemoryPersistence
  }
}

// ── Step 2b: Auth ─────────────────────────────────────────────────────────────
// Only called when FIREBASE_CONFIGURED = true, so apiKey is always non-empty.
// The only expected error here is 'auth/already-initialized' on hot-reload.

function getOrInitAuth(): Auth {
  if (!FIREBASE_CONFIGURED) return _stub<Auth>()
  try {
    return initializeAuth(app, { persistence: buildPersistence() })
  } catch (err) {
    const code    = (err as { code?: string }).code ?? ''
    const message = String((err as { message?: string }).message ?? '')
    if (code === 'auth/already-initialized' || message.toLowerCase().includes('already')) {
      return getAuth(app)
    }
    // Unknown error — log and rethrow (visible in red screen, clearly attributed)
    console.error('[Firebase] initializeAuth unexpected error:', err)
    throw err
  }
}

export const firebaseAuth: Auth = getOrInitAuth()

// ── Step 3: Firestore ─────────────────────────────────────────────────────────

function getOrInitFirestore(): Firestore {
  if (!FIREBASE_CONFIGURED) return _stub<Firestore>()
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
    })
  } catch {
    return getFirestore(app)
  }
}

export const firestore: Firestore = getOrInitFirestore()

// ── Step 4: Storage & Functions ───────────────────────────────────────────────

export const firebaseStorage: FirebaseStorage = FIREBASE_CONFIGURED
  ? getStorage(app)
  : _stub<FirebaseStorage>()

export const firebaseFunctions: Functions = FIREBASE_CONFIGURED
  ? getFunctions(app, 'me-central1')
  : _stub<Functions>()

// ── Emulator connections ──────────────────────────────────────────────────────

if (FIREBASE_CONFIGURED && __DEV__ && process.env['EXPO_PUBLIC_USE_EMULATOR'] === 'true') {
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
