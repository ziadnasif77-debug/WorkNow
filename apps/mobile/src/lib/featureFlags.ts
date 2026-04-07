// ─────────────────────────────────────────────────────────────────────────────
// Feature Flags — Firebase Remote Config
// Fetches flags on app start with 1-hour cache
// Allows instant flag changes from Firebase Console without app update
//
// When FIREBASE_CONFIGURED = false the module is a no-op: all flags return
// their default values and initFeatureFlags resolves immediately.
// Calling getRemoteConfig(stub) at module level would throw
// "Cannot read property 'getProvider' of undefined" because the stub app {}
// has no Firebase internals.
// ─────────────────────────────────────────────────────────────────────────────

import { FEATURE_FLAGS } from '@workfix/config'
import { FIREBASE_CONFIGURED } from './firebase'

// ── Default values (used before first fetch, on failure, or when not configured)
const DEFAULTS = {
  [FEATURE_FLAGS.SUBSCRIPTIONS_ENABLED]:  false as boolean,
  [FEATURE_FLAGS.BOOST_ENABLED]:          false as boolean,
  [FEATURE_FLAGS.DISPUTES_ENABLED]:       true  as boolean,
  [FEATURE_FLAGS.CASH_PAYMENT_ENABLED]:   true  as boolean,
  [FEATURE_FLAGS.AGENCY_MODEL_ENABLED]:   false as boolean,
  [FEATURE_FLAGS.NORWAY_MARKET_ENABLED]:  true  as boolean,
  [FEATURE_FLAGS.SWEDEN_MARKET_ENABLED]:  true  as boolean,
  commission_rate:                        '0.12',
  min_order_amount_sar:                   '50',
  max_quote_expiry_hours:                 '24',
  maintenance_mode:                       false as boolean,
  force_update_version:                   '',
  support_chat_url:                       'https://workfix.app/support',
}

// Remote Config instance — created lazily so we never call getRemoteConfig on a stub
let _remoteConfig: import('firebase/remote-config').RemoteConfig | null = null

function getRC(): import('firebase/remote-config').RemoteConfig | null {
  if (!FIREBASE_CONFIGURED) return null
  if (_remoteConfig) return _remoteConfig
  try {
    const { getRemoteConfig } = require('firebase/remote-config') as typeof import('firebase/remote-config')
    const { firebaseApp }     = require('./firebase') as typeof import('./firebase')
    _remoteConfig = getRemoteConfig(firebaseApp)
    _remoteConfig.settings.minimumFetchIntervalMillis =
      process.env['EXPO_PUBLIC_ENV'] === 'production' ? 3600_000 : 0
    _remoteConfig.defaultConfig = DEFAULTS
  } catch (err) {
    if (__DEV__) console.warn('[FeatureFlags] getRemoteConfig failed', err)
  }
  return _remoteConfig
}

// ── Initialize (call once in app startup) ─────────────────────────────────────

let initialized = false

export async function initFeatureFlags(): Promise<void> {
  if (initialized) return
  initialized = true          // set early so re-entrant calls short-circuit

  if (!FIREBASE_CONFIGURED) {
    if (__DEV__) console.info('[FeatureFlags] Firebase not configured — using defaults')
    return
  }

  try {
    const { fetchAndActivate } = await import('firebase/remote-config')
    const rc = getRC()
    if (rc) {
      await fetchAndActivate(rc)
      if (__DEV__) console.info('[FeatureFlags] Loaded ✓')
    }
  } catch (err) {
    // Use defaults on failure — never crash the app
    if (__DEV__) console.warn('[FeatureFlags] Using defaults:', err)
  }
}

// ── Flag getters ──────────────────────────────────────────────────────────────

function getBool(key: string, def: boolean): boolean {
  const rc = getRC()
  if (!rc) return def
  try {
    const { getValue } = require('firebase/remote-config') as typeof import('firebase/remote-config')
    return getValue(rc, key).asBoolean()
  } catch { return def }
}

function getString(key: string, def: string): string {
  const rc = getRC()
  if (!rc) return def
  try {
    const { getValue } = require('firebase/remote-config') as typeof import('firebase/remote-config')
    return getValue(rc, key).asString()
  } catch { return def }
}

export const Flags = {
  subscriptions:      () => getBool(FEATURE_FLAGS.SUBSCRIPTIONS_ENABLED, false),
  boost:              () => getBool(FEATURE_FLAGS.BOOST_ENABLED, false),
  disputes:           () => getBool(FEATURE_FLAGS.DISPUTES_ENABLED, true),
  cashPayment:        () => getBool(FEATURE_FLAGS.CASH_PAYMENT_ENABLED, true),
  agencyModel:        () => getBool(FEATURE_FLAGS.AGENCY_MODEL_ENABLED, false),
  norwayMarket:       () => getBool(FEATURE_FLAGS.NORWAY_MARKET_ENABLED, true),
  swedenMarket:       () => getBool(FEATURE_FLAGS.SWEDEN_MARKET_ENABLED, true),
  commissionRate:     () => parseFloat(getString('commission_rate', '0.12')),
  maintenanceMode:    () => getBool('maintenance_mode', false),
  forceUpdateVersion: () => getString('force_update_version', ''),

  isPaymentMethodEnabled: (method: string): boolean => {
    if (method === 'cash') return Flags.cashPayment()
    return true  // cards, Apple Pay, Vipps, Swish always on
  },
}

// ── React hook ────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'

export function useFlag(flagName: keyof typeof Flags): boolean {
  const [value, setValue] = useState<boolean>(() => {
    const getter = Flags[flagName]
    return typeof getter === 'function' ? (getter as () => boolean)() : false
  })

  useEffect(() => {
    const getter = Flags[flagName]
    if (typeof getter === 'function') {
      setValue((getter as () => boolean)())
    }
  }, [flagName, initialized])

  return value
}
