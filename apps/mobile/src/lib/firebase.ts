// ─────────────────────────────────────────────────────────────────────────────
// Firebase client SDK — initialized once, exported as singletons
//
// Config source priority:
//   1. EXPO_PUBLIC_* env vars (loaded by Metro at bundle time from .env)
//   2. Hardcoded fallback in @workfix/config (works in Expo Go without .env)
//
// Initialization order (DO NOT reorder):
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
import { getFirebaseConfig }                          from '@workfix/config'

// Keep this export for any existing imports — always true now that we have a fallback config
export const FIREBASE_CONFIGURED = true

// ── Step 1: App ───────────────────────────────────────────────────────────────

function buildApp(): FirebaseApp {
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

function getOrInitAuth(): Auth {
  try {
    return initializeAuth(app, { persistence: buildPersistence() })
  } catch (err) {
    const code    = (err as { code?: string }).code ?? ''
    const message = String((err as { message?: string }).message ?? '')
    if (code === 'auth/already-initialized' || message.toLowerCase().includes('already')) {
      return getAuth(app)
    }
    console.error('[Firebase] initializeAuth unexpected error:', err)
    throw err
  }
}

export const firebaseAuth: Auth = getOrInitAuth()

// ── Step 3: Firestore ─────────────────────────────────────────────────────────

function getOrInitFirestore(): Firestore {
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

export const firebaseStorage: FirebaseStorage = getStorage(app)
export const firebaseFunctions: Functions     = getFunctions(app, 'me-central1')

// ── Emulator connections ──────────────────────────────────────────────────────

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
