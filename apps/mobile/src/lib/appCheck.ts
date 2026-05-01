// ─────────────────────────────────────────────────────────────────────────────
// Firebase App Check — device attestation
//
// Proves to Firebase that requests originate from the genuine WorkNow app on
// a legitimate, unmodified device.  Blocks API scraping, emulators, and
// reverse-engineered clients even when credentials are leaked.
//
// Provider strategy:
//   Development / Expo Go  → debug token (EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN)
//   Production iOS         → DeviceCheck (via native RNFirebase if available)
//                            falls back to reCAPTCHA Enterprise
//   Production Android     → Play Integrity (via native RNFirebase if available)
//                            falls back to reCAPTCHA Enterprise
// ─────────────────────────────────────────────────────────────────────────────

import { getApp } from 'firebase/app'
import {
  initializeAppCheck,
  CustomProvider,
  type AppCheck,
} from 'firebase/app-check'

// AppCheckToken is the shape CustomProvider.getToken must return.
// It lives in @firebase/app-check-types but is not re-exported from firebase/app-check.
interface AppCheckToken {
  readonly token: string
  readonly expireTimeMillis: number
}
import { Platform } from 'react-native'

let _appCheck: AppCheck | null = null

// ── Native provider bridge ────────────────────────────────────────────────────
// @react-native-firebase/app-check wraps the iOS/Android Firebase SDKs which
// use DeviceCheck / Play Integrity directly.  We use it when available and
// bridge its tokens into the Web SDK's CustomProvider.

interface RNFAppCheck {
  newReactNativeFirebaseAppCheckProvider(): {
    configure(config: {
      android?: { provider: 'playIntegrity' | 'safetyNet' | 'debug'; debugToken?: string }
      apple?:   { provider: 'appAttest' | 'deviceCheck' | 'debug'; debugToken?: string }
      web?:     { provider: 'recaptchaV3' | 'recaptchaEnterprise'; siteKey: string }
    }): void
  }
  getToken(forceRefresh?: boolean): Promise<{ token: string; expirationTime: string }>
  addTokenChangedListener(listener: (token: AppCheckToken) => void): () => void
}

function tryLoadNativeAppCheck(): RNFAppCheck | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (require('@react-native-firebase/app-check') as { default: RNFAppCheck }).default
  } catch {
    return null
  }
}

// ── Debug token (dev only) ────────────────────────────────────────────────────

function setDebugToken(): void {
  const debugToken = process.env['EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN']
  if (debugToken) {
    // Firebase checks this global before generating a real token in debug builds
    (globalThis as Record<string, unknown>)['FIREBASE_APPCHECK_DEBUG_TOKEN'] = debugToken
  }
}

// ── getToken implementation ───────────────────────────────────────────────────

async function getNativeToken(rnfAppCheck: RNFAppCheck): Promise<AppCheckToken> {
  const result = await rnfAppCheck.getToken(false)
  return {
    token:             result.token,
    expireTimeMillis:  new Date(result.expirationTime).getTime(),
  }
}

// ── Public initializer ────────────────────────────────────────────────────────

/**
 * Initialize Firebase App Check.  Must be called once before any Firestore /
 * Auth / Functions calls — ideally at app boot in _layout.tsx.
 *
 * Returns the AppCheck instance (or null if initialization fails, which should
 * never happen in a properly configured production build).
 */
export async function initAppCheck(): Promise<AppCheck | null> {
  if (_appCheck) return _appCheck

  try {
    const app           = getApp()
    const isProduction  = process.env['EXPO_PUBLIC_ENV'] === 'production'
    const rnfAppCheck   = tryLoadNativeAppCheck()

    if (!isProduction) {
      // ── Development / Expo Go ──────────────────────────────────────────────
      setDebugToken()

      _appCheck = initializeAppCheck(app, {
        provider: new CustomProvider({
          getToken: async () => {
            const debugToken = process.env['EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN']
            // Firebase SDK picks up FIREBASE_APPCHECK_DEBUG_TOKEN automatically;
            // returning a minimal valid result here satisfies the type contract.
            return {
              token:            debugToken ?? 'debug-token-not-set',
              expireTimeMillis: Date.now() + 3_600_000, // 1 hour
            }
          },
        }),
        isTokenAutoRefreshEnabled: true,
      })
      return _appCheck
    }

    // ── Production ────────────────────────────────────────────────────────────
    if (rnfAppCheck && (Platform.OS === 'ios' || Platform.OS === 'android')) {
      // Configure native provider with the strongest attestation available
      const provider = rnfAppCheck.newReactNativeFirebaseAppCheckProvider()
      provider.configure({
        android: { provider: 'playIntegrity' },
        apple:   { provider: 'appAttest' },
      })

      _appCheck = initializeAppCheck(app, {
        provider: new CustomProvider({
          getToken: () => getNativeToken(rnfAppCheck),
        }),
        isTokenAutoRefreshEnabled: true,
      })
      return _appCheck
    }

    // ── Fallback: reCAPTCHA Enterprise (web / unsupported platforms) ──────────
    const siteKey = process.env['EXPO_PUBLIC_RECAPTCHA_SITE_KEY']
    if (!siteKey) {
      if (__DEV__) console.warn('[AppCheck] EXPO_PUBLIC_RECAPTCHA_SITE_KEY not set — App Check disabled')
      return null
    }

    const { ReCaptchaEnterpriseProvider } = await import('firebase/app-check')
    _appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
    return _appCheck
  } catch (err) {
    if (__DEV__) console.warn('[AppCheck] Initialization failed:', err)
    return null
  }
}

/** Returns the current App Check instance (null before initAppCheck is called). */
export function getAppCheck(): AppCheck | null {
  return _appCheck
}

