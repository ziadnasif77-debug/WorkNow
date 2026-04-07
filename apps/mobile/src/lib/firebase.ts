// ─────────────────────────────────────────────────────────────────────────────
// Firebase client SDK — initialized once, exported as singletons
//
// Cold start : initializeApp + initializeAuth (registers auth component)
// Hot reload : getApp + getAuth            (reuses already-registered auth)
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp }              from 'firebase/app'
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth'
import AsyncStorage                                          from '@react-native-async-storage/async-storage'
import {
  initializeFirestore, getFirestore,
  persistentLocalCache, CACHE_SIZE_UNLIMITED,
}                                                       from 'firebase/firestore'
import { getStorage }                                   from 'firebase/storage'
import { getFunctions }                                 from 'firebase/functions'
import { getFirebaseConfig }                            from '@workfix/config'

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

// ── Backward-compat exports ───────────────────────────────────────────────────

export const FIREBASE_CONFIGURED = true
export { app as firebaseApp }
