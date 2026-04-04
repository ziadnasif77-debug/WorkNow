// ─────────────────────────────────────────────────────────────────────────────
// Payment WebView — hosts Tap Payments checkout page
// Intercepts the callback URL to detect success / failure
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'

// Tap Payments redirects back to our callback URL after payment
const SUCCESS_INDICATORS = ['tap_id=', 'status=CAPTURED', 'status=AUTHORIZED']
const FAILURE_INDICATORS = ['status=CANCELLED', 'status=DECLINED', 'status=FAILED']

export default function PaymentWebViewScreen() {
  const { t }    = useTranslation()
  const router   = useRouter()
  const { url, orderId } = useLocalSearchParams<{ url: string; orderId: string }>()

  const [isLoading,  setIsLoading]  = useState(true)
  const [loadError,  setLoadError]  = useState(false)
  const [progress,   setProgress]   = useState(0)
  const webviewRef = useRef<WebView>(null)

  function handleNavigation(event: WebViewNavigation): boolean {
    const navUrl = event.url

    // Intercept deep-link callback
    if (navUrl.startsWith('workfix://')) {
      handleCallback(navUrl)
      return false  // prevent WebView from navigating
    }

    // Detect success from Tap redirect URL parameters
    if (SUCCESS_INDICATORS.some(s => navUrl.includes(s))) {
      handleSuccess()
      return false
    }

    // Detect failure
    if (FAILURE_INDICATORS.some(s => navUrl.includes(s))) {
      handleFailure()
      return false
    }

    return true  // allow navigation
  }

  function handleCallback(callbackUrl: string) {
    if (callbackUrl.includes('success') || SUCCESS_INDICATORS.some(s => callbackUrl.includes(s))) {
      handleSuccess()
    } else {
      handleFailure()
    }
  }

  function handleSuccess() {
    router.replace({
      pathname: '/orders/payment-success',
      params: { orderId },
    })
  }

  function handleFailure() {
    Alert.alert(
      t('payment.failed'),
      t('payment.failedDesc'),
      [
        { text: t('payment.tryAgain'), style: 'default', onPress: () => router.back() },
        { text: t('common.cancel'),   style: 'cancel',  onPress: () => router.replace({ pathname: '/orders/[id]', params: { id: orderId } }) },
      ],
    )
  }

  if (!url) {
    return (
      <View style={styles.error_screen}>
        <Text style={styles.error_emoji}>❌</Text>
        <Text style={styles.error_text}>{t('payment.invalidSession')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.error_btn}>
          <Text style={styles.error_btn_text}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => Alert.alert(
            t('payment.cancelTitle'),
            t('payment.cancelDesc'),
            [
              { text: t('payment.continuePaying'), style: 'cancel' },
              { text: t('payment.cancelPayment'), style: 'destructive', onPress: () => router.back() },
            ],
          )}
          style={styles.close_btn}
        >
          <Text style={styles.close_icon}>✕</Text>
        </TouchableOpacity>
        <View style={styles.header_center}>
          <Text style={styles.header_title}>{t('payment.securePayment')}</Text>
          <View style={styles.secure_badge}>
            <Text style={styles.secure_icon}>🔒</Text>
            <Text style={styles.secure_text}>Tap Payments</Text>
          </View>
        </View>
        <View style={styles.header_spacer} />
      </View>

      {/* Progress bar */}
      {isLoading && (
        <View style={styles.progress_track}>
          <View style={[styles.progress_fill, { width: `${progress}%` }]} />
        </View>
      )}

      {/* WebView */}
      {!loadError ? (
        <WebView
          ref={webviewRef}
          source={{ uri: decodeURIComponent(url) }}
          style={styles.webview}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress * 100)}
          onError={() => setLoadError(true)}
          onNavigationStateChange={state => { handleNavigation(state) }}
          onShouldStartLoadWithRequest={handleNavigation}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['https://*', 'workfix://*']}
          userAgent="WorkFix/1.0 Mobile"
          // Security: restrict to Tap Payments domains
        />
      ) : (
        <View style={styles.error_screen}>
          <Text style={styles.error_emoji}>📡</Text>
          <Text style={styles.error_text}>{t('payment.loadError')}</Text>
          <TouchableOpacity
            style={styles.error_btn}
            onPress={() => { setLoadError(false); webviewRef.current?.reload() }}
          >
            <Text style={styles.error_btn_text}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && (
        <View style={styles.loading_overlay}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loading_text}>{t('payment.loading')}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  close_btn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  close_icon:    { fontSize: 18, color: Colors.gray600 },
  header_center: { flex: 1, alignItems: 'center', gap: 2 },
  header_title:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  secure_badge:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secure_icon:   { fontSize: 11 },
  secure_text:   { fontSize: FontSize.xs, color: Colors.gray400 },
  header_spacer: { width: 36 },

  progress_track: { height: 3, backgroundColor: Colors.gray100 },
  progress_fill:  { height: '100%', backgroundColor: Colors.primary },

  webview: { flex: 1 },

  loading_overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  loading_text: { fontSize: FontSize.md, color: Colors.gray500 },

  error_screen:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  error_emoji:    { fontSize: 52 },
  error_text:     { fontSize: FontSize.lg, color: Colors.gray600, textAlign: 'center' },
  error_btn:      { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  error_btn_text: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
})
