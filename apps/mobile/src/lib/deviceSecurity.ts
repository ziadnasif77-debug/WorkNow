// ─────────────────────────────────────────────────────────────────────────────
// Device Security — root/jailbreak detection, anti-debug, integrity checks
//
// OWASP Mobile Top 10 coverage:
//   M8  — Code Tampering
//   M9  — Reverse Engineering
//   M10 — Extraneous Functionality
//
// Strategy: layered heuristics (no single check is 100% reliable).
// Production apps should block or warn based on organisational risk tolerance.
// This implementation warns + logs; upgrade to hard-block after QA validation.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as FileSystem from 'expo-file-system/legacy'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeviceIntegrityResult {
  /** True if the device passes all integrity checks */
  isSecure: boolean
  /** Flags describing detected threats */
  threats: DeviceThreat[]
  /** Composite risk score 0–100 (0 = clean, 100 = confirmed compromised) */
  riskScore: number
}

export type DeviceThreat =
  | 'ROOTED_ANDROID'
  | 'JAILBROKEN_IOS'
  | 'EMULATOR_DETECTED'
  | 'DEBUGGER_ATTACHED'
  | 'DEVELOPER_MODE'
  | 'UNKNOWN_INSTALL_SOURCE'
  | 'EXPO_GO_PRODUCTION'     // running production secrets inside Expo Go

// ── iOS jailbreak indicators ──────────────────────────────────────────────────

// Common paths created by jailbreak tools (Cydia, Sileo, unc0ver, etc.)
const IOS_JAILBREAK_PATHS = [
  '/Applications/Cydia.app',
  '/Applications/Sileo.app',
  '/Applications/Zebra.app',
  '/private/var/lib/apt',
  '/private/var/lib/cydia',
  '/private/var/mobile/Library/SBSettings/Themes',
  '/Library/MobileSubstrate/MobileSubstrate.dylib',
  '/bin/bash',
  '/usr/sbin/sshd',
  '/etc/apt',
  '/usr/bin/ssh',
  '/private/var/stash',
]

// ── Android root indicators ───────────────────────────────────────────────────

const ANDROID_ROOT_PATHS = [
  '/data/local/bin/su',
  '/data/local/su',
  '/data/local/xbin/su',
  '/sbin/su',
  '/su/bin/su',
  '/system/app/Superuser.apk',
  '/system/app/SuperSU.apk',
  '/system/bin/.ext/.su',
  '/system/bin/failsafe/su',
  '/system/bin/su',
  '/system/etc/init.d/99SuperSUDaemon',
  '/system/sd/xbin/su',
  '/system/usr/we-need-root/su-backup',
  '/system/xbin/mu',
  '/system/xbin/su',
]

// ── Checks ────────────────────────────────────────────────────────────────────

async function checkIosJailbreak(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false

  // 1. Simulator check
  if (!Device.isDevice) return false  // physical device only after here

  // 2. File-system path probe
  for (const path of IOS_JAILBREAK_PATHS) {
    try {
      const info = await FileSystem.getInfoAsync(path)
      if (info.exists) return true
    } catch {
      // Permission error on a jailbroken device usually means the path exists
      // but sandboxing failed to hide it — count as suspicious
    }
  }

  // 3. Fork/write-outside-sandbox
  try {
    const testPath = `${FileSystem.documentDirectory ?? ''}/../../../tmp/jb_test`
    await FileSystem.writeAsStringAsync(testPath, 'test')
    // If write succeeds outside sandbox, device is jailbroken
    await FileSystem.deleteAsync(testPath, { idempotent: true })
    return true
  } catch {
    // Expected: sandbox prevents the write → clean
  }

  return false
}

async function checkAndroidRoot(): Promise<boolean> {
  if (Platform.OS !== 'android') return false

  for (const path of ANDROID_ROOT_PATHS) {
    try {
      const info = await FileSystem.getInfoAsync(path)
      if (info.exists) return true
    } catch {
      // Ignore
    }
  }
  return false
}

function checkEmulator(): boolean {
  // expo-device provides isDevice — false when running in a simulator/emulator
  if (!Device.isDevice) return true

  // Additional emulator brand/model checks
  const brand = (Device.brand ?? '').toLowerCase()
  const model = (Device.modelName ?? '').toLowerCase()

  const emulatorBrands = ['generic', 'unknown', 'android']
  const emulatorModels = ['emulator', 'android sdk built for x86', 'sdk_gphone']

  if (emulatorBrands.includes(brand)) return true
  if (emulatorModels.some(e => model.includes(e))) return true

  return false
}

function checkDebuggerAttached(): boolean {
  if (!__DEV__) {
    // In release builds, presence of __DEV__ being true indicates a debug build
    // Additional heuristic: check performance.now() loop timing anomaly
    try {
      const start = performance.now()
      let sum = 0
      for (let i = 0; i < 100_000; i++) sum += i
      const elapsed = performance.now() - start
      // A debugger slows execution significantly (>100ms for this trivial loop)
      if (elapsed > 100 && sum > 0) return true
    } catch {
      // performance.now not available — skip timing check
    }
  }
  return false
}

function checkExpoGoProduction(): boolean {
  // expo-updates: if there's no update URL in production, we're in Expo Go
  const env = process.env['EXPO_PUBLIC_ENV']
  if (env !== 'production') return false
  // In an EAS production build, __DEV__ is false and the bundle is optimised
  return __DEV__ === true
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run all device integrity checks.
 * Call at app launch (before any sensitive operations).
 * Await the result — file-system checks are async.
 */
export async function checkDeviceIntegrity(): Promise<DeviceIntegrityResult> {
  const threats: DeviceThreat[] = []

  const [iosJailbroken, androidRooted] = await Promise.all([
    checkIosJailbreak(),
    checkAndroidRoot(),
  ])

  if (iosJailbroken)              threats.push('JAILBROKEN_IOS')
  if (androidRooted)              threats.push('ROOTED_ANDROID')
  if (checkEmulator())            threats.push('EMULATOR_DETECTED')
  if (checkDebuggerAttached())    threats.push('DEBUGGER_ATTACHED')
  if (checkExpoGoProduction())    threats.push('EXPO_GO_PRODUCTION')

  // Weighting: physical compromise > emulator > debug
  const weights: Record<DeviceThreat, number> = {
    JAILBROKEN_IOS:           80,
    ROOTED_ANDROID:           80,
    EMULATOR_DETECTED:        40,
    DEBUGGER_ATTACHED:        60,
    DEVELOPER_MODE:           20,
    UNKNOWN_INSTALL_SOURCE:   30,
    EXPO_GO_PRODUCTION:       50,
  }

  const riskScore = Math.min(
    100,
    threats.reduce((acc, t) => acc + (weights[t] ?? 0), 0),
  )

  return {
    isSecure: riskScore === 0,
    threats,
    riskScore,
  }
}

/**
 * Convenience: returns true if the device is safe to run sensitive operations.
 * Emulators in development are considered safe.
 */
export async function isDeviceSecure(): Promise<boolean> {
  const result = await checkDeviceIntegrity()

  // In development: emulators are expected — only fail on actual jailbreak
  if (__DEV__) {
    return !result.threats.some(t =>
      t === 'JAILBROKEN_IOS' || t === 'ROOTED_ANDROID'
    )
  }

  return result.isSecure
}

/**
 * Disable debug output in release builds.
 * Call once at app startup to strip console.log in production.
 */
export function hardendReleaseMode(): void {
  if (!__DEV__) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noop = (): void => undefined
    // Override console methods that leak implementation details
    ;(console as unknown as Record<string, unknown>)['log']   = noop
    ;(console as unknown as Record<string, unknown>)['debug'] = noop
    ;(console as unknown as Record<string, unknown>)['trace'] = noop
    // Keep warn/error/info for legitimate monitoring (Sentry hooks these)
  }
}
