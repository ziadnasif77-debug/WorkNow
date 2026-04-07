// ─────────────────────────────────────────────────────────────────────────────
// Firebase client SDK — initialized once, exported as singletons
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth }                         from 'firebase/auth'
import {
  initializeFirestore, getFirestore,
  persistentLocalCache, CACHE_SIZE_UNLIMITED,
}                                          from 'firebase/firestore'
import { getStorage }                      from 'firebase/storage'
import { getFunctions }                    from 'firebase/functions'
import { getFirebaseConfig }               from '@workfix/config'

// ── App ───────────────────────────────────────────────────────────────────────

const firebaseConfig = getFirebaseConfig()

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp()

// ── Auth ──────────────────────────────────────────────────────────────────────
// getAuth auto-initializes with inMemoryPersistence in React Native / Expo Go.
// For production (dev build), replace with initializeAuth + getReactNativePersistence.

export const firebaseAuth = getAuth(app)

// ── Firestore ─────────────────────────────────────────────────────────────────

function initFirestore() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
    })
  } catch {
    return getFirestore(app)
  }
}

export const firestore = initFirestore()

// ── Storage & Functions ───────────────────────────────────────────────────────

export const firebaseStorage   = getStorage(app)
export const firebaseFunctions = getFunctions(app, 'me-central1')

// ── Backward-compat exports ───────────────────────────────────────────────────

export const FIREBASE_CONFIGURED = true
export { app as firebaseApp }
