import React, { useEffect, useCallback, useRef } from 'react'
import { Stack } from 'expo-router'
import { useRouter, useSegments } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import AsyncStorage               from '@react-native-async-storage/async-storage'
import { useAuthStore }     from '../stores/authStore'
import { useNotifications } from '../hooks/useNotifications'
import { ErrorBoundary }    from '../components/ErrorBoundary'
import { initSentry, setMonitoringUser, logDeviceIntegrityFailure } from '../lib/monitoring'
import { initFeatureFlags } from '../lib/featureFlags'
import { Colors }           from '../constants/theme'
import { OfflineBanner }    from '../components/OfflineBanner'
import '../lib/i18n'

const ONBOARDING_KEY = 'onboarding_done'

export default function RootLayout() {
  return <AuthenticatedLayout />
}

function AuthenticatedLayout() {
  const initialize     = useAuthStore(s => s.initialize)
  const firebaseUser   = useAuthStore(s => s.firebaseUser)
  const role           = useAuthStore(s => s.role)
  const isInitialized  = useAuthStore(s => s.isInitialized)
  const router         = useRouter()
  const segments       = useSegments()
  const onboardingChecked = useRef(false)

  // Monitoring + feature flags — run once at boot
  useEffect(() => {
    initSentry()
    void initFeatureFlags()

    // Security hardening — deferred and lazy-loaded to avoid module-init
    // native calls crashing Expo Go before the TurboModule registry is ready
    if (!__DEV__) {
      void import('../lib/deviceSecurity').then(({ hardendReleaseMode, checkDeviceIntegrity }) => {
        hardendReleaseMode()
        void checkDeviceIntegrity().then(result => {
          if (!result.isSecure) logDeviceIntegrityFailure(result.threats)
        })
      })
      void import('../lib/networkSecurity').then(({ enforceHTTPSGlobally }) => {
        enforceHTTPSGlobally()
      })
      void import('../lib/appCheck').then(({ initAppCheck }) => {
        void initAppCheck()
      })
    }
  }, [])

  const stableInit = useCallback(() => initialize(), [initialize])
  useEffect(() => {
    const unsubscribe = stableInit()
    return unsubscribe
  }, [stableInit])

  useEffect(() => {
    if (firebaseUser?.uid && role) {
      setMonitoringUser(firebaseUser.uid, role)
    }
  }, [firebaseUser?.uid, role])

  useNotifications()

  useEffect(() => {
    if (!isInitialized) return
    const seg0 = segments[0]

    if (!firebaseUser) {
      if (seg0 !== 'onboarding' && seg0 !== 'auth') {
        if (onboardingChecked.current) return
        onboardingChecked.current = true
        void AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
          if (val === 'true') {
            router.replace('/auth/login')
          } else {
            router.replace('/onboarding')
          }
        })
      }
    } else {
      if (seg0 === 'auth' || seg0 === 'onboarding') {
        if (role === 'admin' || role === 'superadmin') {
          router.replace('/(admin)')
        } else {
          router.replace(role === 'provider' ? '/(tabs)/provider' : '/(tabs)')
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, isInitialized, segments])

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <OfflineBanner />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)"     options={{ headerShown: false }} />
            <Stack.Screen name="(admin)"    options={{ headerShown: false }} />
            <Stack.Screen name="auth"       options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          </Stack>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
