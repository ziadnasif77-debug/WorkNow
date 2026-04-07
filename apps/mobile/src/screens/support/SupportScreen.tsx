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
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'
import { useIsOnline } from '../../hooks/useNetworkState'

const SUPPORT_PAGES: Record<string, { title_key: string; url: string }> = {
  faq:     { title_key: 'profile.faq',       url: 'https://workfix.app/faq' },
  contact: { title_key: 'profile.contactUs', url: 'https://workfix.app/contact' },
  terms:   { title_key: 'profile.terms',     url: 'https://workfix.app/terms' },
  privacy: { title_key: 'privacy.screenTitle', url: 'https://workfix.app/privacy' },
}

export default function SupportScreen() {
  const router       = useRouter()
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
        source={{ uri: config.url }}
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
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1, borderBottomColor: '#F59E0B',
  },
  offline_text: { fontSize: FontSize.sm, color: '#92400E', flex: 1 },
  offline_link: { fontSize: FontSize.sm, color: '#1D4ED8', fontWeight: FontWeight.bold },
  error_container: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  error_text: { fontSize: FontSize.md, color: Colors.gray600, textAlign: 'center', marginBottom: Spacing.lg },
  open_btn:      { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: 8 },
  open_btn_text: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
})
