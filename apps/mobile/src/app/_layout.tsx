import React, { useEffect, useCallback } from 'react'
import { Stack } from 'expo-router'
import { useRouter, useSegments } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore }     from '../stores/authStore'
import { useNotifications } from '../hooks/useNotifications'
import { ErrorBoundary }    from '../components/ErrorBoundary'
import { initSentry, setMonitoringUser } from '../lib/monitoring'
import { initFeatureFlags } from '../lib/featureFlags'
import { Colors }           from '../constants/theme'
import { OfflineBanner }    from '../components/OfflineBanner'
import '../lib/i18n'

type MMKVLike = { getBoolean: (k: string) => boolean | undefined }
let _onboardingStorage: MMKVLike
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { MMKV } = require('react-native-mmkv') as { MMKV: new (opts: { id: string }) => MMKVLike }
  const _mmkv = new MMKV({ id: 'app' })
  _onboardingStorage = { getBoolean: (k) => _mmkv.getBoolean(k) }
} catch {
  _onboardingStorage = { getBoolean: () => undefined }
}
function hasSeenOnboarding(): boolean {
  return _onboardingStorage.getBoolean('onboarding_done') === true
}

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

  // Initialize monitoring and feature flags after runtime is ready
  useEffect(() => {
    initSentry()
    void initFeatureFlags()
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
        if (!hasSeenOnboarding()) {
          router.replace('/onboarding')
        } else {
          router.replace('/auth/login')
        }
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
