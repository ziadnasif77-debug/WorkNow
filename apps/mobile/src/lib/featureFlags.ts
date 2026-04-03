// ─────────────────────────────────────────────────────────────────────────────
// Feature Flags — Firebase Remote Config
// Fetches flags on app start with 1-hour cache
// Allows instant flag changes from Firebase Console without app update
// ─────────────────────────────────────────────────────────────────────────────

import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config'
import { firebaseApp } from './firebase'
import { FEATURE_FLAGS } from '@workfix/config'

// ── Remote Config instance ────────────────────────────────────────────────────

const remoteConfig = getRemoteConfig(firebaseApp)

// Cache duration: 1 hour in production, 0 in dev for faster iteration
remoteConfig.settings.minimumFetchIntervalMillis =
  process.env['EXPO_PUBLIC_ENV'] === 'production' ? 3600_000 : 0

// ── Default values (used before first fetch or if fetch fails) ────────────────

remoteConfig.defaultConfig = {
  [FEATURE_FLAGS.SUBSCRIPTIONS_ENABLED]:  false,
  [FEATURE_FLAGS.BOOST_ENABLED]:          false,
  [FEATURE_FLAGS.DISPUTES_ENABLED]:       true,
  [FEATURE_FLAGS.CASH_PAYMENT_ENABLED]:   true,
  [FEATURE_FLAGS.AGENCY_MODEL_ENABLED]:   false,
  [FEATURE_FLAGS.NORWAY_MARKET_ENABLED]:  true,
  [FEATURE_FLAGS.SWEDEN_MARKET_ENABLED]:  true,
  // Additional runtime flags
  commission_rate:                        '0.12',
  min_order_amount_sar:                   '50',
  max_quote_expiry_hours:                 '24',
  maintenance_mode:                       false,
  force_update_version:                   '',
  support_chat_url:                       'https://workfix.app/support',
}

// ── Initialize (call once in app startup) ─────────────────────────────────────

let initialized = false

export async function initFeatureFlags(): Promise<void> {
  if (initialized) return
  try {
    await fetchAndActivate(remoteConfig)
    initialized = true
    if (__DEV__) console.info('[FeatureFlags] Loaded ✓')
  } catch (err) {
    // Use defaults on failure — never crash the app
    if (__DEV__) console.warn('[FeatureFlags] Using defaults')
    initialized = true
  }
}

// ── Flag getters ──────────────────────────────────────────────────────────────

export const Flags = {
  subscriptions:  () => getValue(remoteConfig, FEATURE_FLAGS.SUBSCRIPTIONS_ENABLED).asBoolean(),
  boost:          () => getValue(remoteConfig, FEATURE_FLAGS.BOOST_ENABLED).asBoolean(),
  disputes:       () => getValue(remoteConfig, FEATURE_FLAGS.DISPUTES_ENABLED).asBoolean(),
  cashPayment:    () => getValue(remoteConfig, FEATURE_FLAGS.CASH_PAYMENT_ENABLED).asBoolean(),
  agencyModel:    () => getValue(remoteConfig, FEATURE_FLAGS.AGENCY_MODEL_ENABLED).asBoolean(),
  norwayMarket:   () => getValue(remoteConfig, FEATURE_FLAGS.NORWAY_MARKET_ENABLED).asBoolean(),
  swedenMarket:   () => getValue(remoteConfig, FEATURE_FLAGS.SWEDEN_MARKET_ENABLED).asBoolean(),
  commissionRate: () => parseFloat(getValue(remoteConfig, 'commission_rate').asString()),
  maintenanceMode: () => getValue(remoteConfig, 'maintenance_mode').asBoolean(),
  forceUpdateVersion: () => getValue(remoteConfig, 'force_update_version').asString(),

  // Check if a payment method is enabled in the current config
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
    // Re-read after remote config refreshes
    const getter = Flags[flagName]
    if (typeof getter === 'function') {
      setValue((getter as () => boolean)())
    }
  }, [flagName, initialized])

  return value
}
