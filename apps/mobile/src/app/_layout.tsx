// ─────────────────────────────────────────────────────────────────────────────
// Root layout — initializes Firebase auth listener and routes accordingly
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useCallback } from 'react'
import { Stack } from 'expo-router'
import { useRouter, useSegments } from 'expo-router'
import {
  ActivityIndicator, View, Text, StyleSheet, ScrollView, Platform,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore }     from '../stores/authStore'
import { useNotifications } from '../hooks/useNotifications'
import { ErrorBoundary }    from '../components/ErrorBoundary'
import { initSentry, setMonitoringUser } from '../lib/monitoring'
import { initFeatureFlags } from '../lib/featureFlags'
import { Colors }           from '../constants/theme'
import { OfflineBanner }    from '../components/OfflineBanner'
import { FIREBASE_CONFIGURED } from '../lib/firebase'
import '../lib/i18n'

// Initialize monitoring + feature flags at module load (before first render)
initSentry()
void initFeatureFlags()

// ─────────────────────────────────────────────────────────────────────────────
// Config-missing screen — shown when .env is not filled in
// ─────────────────────────────────────────────────────────────────────────────

function ConfigMissingScreen() {
  return (
    <SafeAreaView style={cfgStyles.safe}>
      <ScrollView contentContainerStyle={cfgStyles.container}>
        <Text style={cfgStyles.icon}>🔧</Text>
        <Text style={cfgStyles.title}>Firebase Not Configured</Text>
        <Text style={cfgStyles.subtitle}>
          The app needs real Firebase credentials to start.
        </Text>

        <View style={cfgStyles.card}>
          <Text style={cfgStyles.step}>1. Open <Text style={cfgStyles.code}>apps/mobile/.env</Text></Text>
          <Text style={cfgStyles.step}>2. Replace each placeholder with the real value from your{' '}
            <Text style={cfgStyles.link}>Firebase Console</Text>
            {' '}→ Project Settings → Your apps</Text>
          <Text style={cfgStyles.step}>3. Restart the bundler:</Text>
          <View style={cfgStyles.cmdBox}>
            <Text style={cfgStyles.cmd}>expo start --clear</Text>
          </View>
        </View>

        <View style={cfgStyles.card}>
          <Text style={cfgStyles.label}>Required keys in .env</Text>
          {[
            'EXPO_PUBLIC_FIREBASE_API_KEY',
            'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
            'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
            'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
            'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
            'EXPO_PUBLIC_FIREBASE_APP_ID',
          ].map(k => (
            <Text key={k} style={cfgStyles.key}>{k}</Text>
          ))}
        </View>

        <Text style={cfgStyles.hint}>
          See <Text style={cfgStyles.code}>apps/mobile/.env.example</Text> for a template.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const cfgStyles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0f172a' },
  container: { padding: 24, alignItems: 'center' },
  icon:      { fontSize: 48, marginTop: 32, marginBottom: 8 },
  title:     { fontSize: 22, fontWeight: '700', color: '#f1f5f9', textAlign: 'center', marginBottom: 8 },
  subtitle:  { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 24 },
  card:      {
    width: '100%', backgroundColor: '#1e293b', borderRadius: 12,
    padding: 16, marginBottom: 16,
  },
  label:     { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  step:      { fontSize: 14, color: '#cbd5e1', marginBottom: 10, lineHeight: 20 },
  link:      { color: '#60a5fa', fontWeight: '600' },
  code:      { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#fbbf24', fontSize: 13 },
  cmdBox:    { backgroundColor: '#0f172a', borderRadius: 8, padding: 12, marginTop: 4 },
  cmd:       { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#4ade80', fontSize: 13 },
  key:       {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11, color: '#7dd3fc', marginBottom: 6,
  },
  hint:      { fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 8 },
})

// ─────────────────────────────────────────────────────────────────────────────
// Root layout
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  // Short-circuit: show config screen before attempting any Firebase calls
  if (!FIREBASE_CONFIGURED) {
    return (
      <SafeAreaProvider>
        <ConfigMissingScreen />
      </SafeAreaProvider>
    )
  }

  return <AuthenticatedLayout />
}

function AuthenticatedLayout() {
  const initialize     = useAuthStore(s => s.initialize)
  const firebaseUser   = useAuthStore(s => s.firebaseUser)
  const role           = useAuthStore(s => s.role)
  const isInitialized  = useAuthStore(s => s.isInitialized)
  const router         = useRouter()
  const segments       = useSegments()

  // Start auth listener — stable ref with useCallback
  const stableInit = useCallback(() => initialize(), [initialize])
  useEffect(() => {
    const unsubscribe = stableInit()
    return unsubscribe
  }, [stableInit])

  // Set monitoring context when user signs in
  useEffect(() => {
    if (firebaseUser?.uid && role) {
      setMonitoringUser(firebaseUser.uid, role)
    }
  }, [firebaseUser?.uid, role])

  // Wire FCM + in-app notifications
  useNotifications()

  // Route guard — runs after auth state is known
  useEffect(() => {
    if (!isInitialized) return
    const inAuthGroup = segments[0] === 'auth'

    if (!firebaseUser) {
      if (!inAuthGroup) router.replace('/auth/login')
    } else {
      if (inAuthGroup) {
        router.replace(role === 'provider' ? '/(tabs)/provider' : '/(tabs)')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, isInitialized, segments])

  // Show spinner while resolving auth state
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
            <Stack.Screen name="auth"       options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          </Stack>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
