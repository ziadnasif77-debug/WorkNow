// ─────────────────────────────────────────────────────────────────────────────
// Support screens — FAQ, Contact Us, Terms, Privacy Policy
// All use a shared WebView to load content from workfix.app
// Shows an offline banner when there is no network connection
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native'
import { WebView } from 'react-native-webview'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme'
import { useIsOnline } from '../../hooks/useNetworkState'

const SUPPORT_PAGES: Record<string, { title_key: string; url: string }> = {
  faq:     { title_key: 'profile.faq',       url: 'https://workfix.app/faq' },
  contact: { title_key: 'profile.contactUs', url: 'https://workfix.app/contact' },
  terms:   { title_key: 'profile.terms',     url: 'https://workfix.app/terms' },
  privacy: { title_key: 'privacy.screenTitle', url: 'https://workfix.app/privacy' },
}

// Static fallback shown when the device is offline
const OFFLINE_HTML = (title: string) => `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,sans-serif;padding:24px;background:#f9f9f9;color:#333;text-align:center}
  h2{color:#2563eb;margin-top:48px}
  p{color:#666;line-height:1.7;margin:12px 0}
  a{color:#2563eb;font-weight:bold}
  .icon{font-size:48px;margin:32px 0 16px}
</style>
</head>
<body>
  <div class="icon">📶</div>
  <h2>${title}</h2>
  <p>لا يوجد اتصال بالإنترنت حالياً.</p>
  <p>يُرجى التحقق من اتصالك ثم إعادة المحاولة.</p>
  <p style="margin-top:32px">للتواصل معنا:<br>
    <a href="mailto:support@workfix.app">support@workfix.app</a><br>
    <a href="tel:+966112345678">+966 11 234 5678</a>
  </p>
</body>
</html>`

export default function SupportScreen() {
  const _router      = useRouter()
  const { page }     = useLocalSearchParams<{ page?: string }>()
  const { t }        = useTranslation()
  const isConnected  = useIsOnline()

  const config = SUPPORT_PAGES[page ?? 'faq'] ?? SUPPORT_PAGES['faq']!

  return (
    <View style={styles.container}>
      <ScreenHeader title={t(config.title_key)} />

      {!isConnected && (
        <View style={styles.offline_banner}>
          <Text style={styles.offline_text}>{t('support.offlineBanner')}</Text>
          <TouchableOpacity onPress={() => void Linking.openURL(config.url)}>
            <Text style={styles.offline_link}>{t('support.openBrowser')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <WebView
        source={
          isConnected
            ? { uri: config.url }
            : { html: OFFLINE_HTML(t(config.title_key)), baseUrl: '' }
        }
        style={styles.webview}
        javaScriptEnabled
        userAgent="WorkFix/1.0 Mobile"
        renderError={() => (
          <View style={styles.error_container}>
            <Text style={styles.error_text}>{t('support.loadError')}</Text>
            <TouchableOpacity onPress={() => void Linking.openURL(config.url)} style={styles.open_btn}>
              <Text style={styles.open_btn_text}>{t('support.openBrowser')}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  webview:   { flex: 1 },
  offline_banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    backgroundColor: Colors.warningLight,
    borderBottomWidth: 1, borderBottomColor: Colors.amber,
  },
  offline_text: { fontSize: FontSize.sm, color: Colors.warningDark, flex: 1 },
  offline_link: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  error_container: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  error_text: { fontSize: FontSize.md, color: Colors.gray600, textAlign: 'center', marginBottom: Spacing.lg },
  open_btn:      { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  open_btn_text: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
})
