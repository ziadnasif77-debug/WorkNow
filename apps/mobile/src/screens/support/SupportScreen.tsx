// ─────────────────────────────────────────────────────────────────────────────
// Support screens — FAQ, Contact Us, Terms, Privacy Policy
// All use a shared WebView to load content from workfix.app
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { WebView } from 'react-native-webview'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'

const SUPPORT_PAGES: Record<string, { title: string; url: string }> = {
  faq:     { title: 'الأسئلة الشائعة',      url: 'https://workfix.app/faq' },
  contact: { title: 'تواصل معنا',            url: 'https://workfix.app/contact' },
  terms:   { title: 'الشروط والأحكام',       url: 'https://workfix.app/terms' },
  privacy: { title: 'سياسة الخصوصية',       url: 'https://workfix.app/privacy' },
}

export default function SupportScreen() {
  const router  = useRouter()
  const { page } = useLocalSearchParams<{ page?: string }>()

  const config = SUPPORT_PAGES[page ?? 'faq'] ?? SUPPORT_PAGES['faq']!

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.back_icon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{config.title}</Text>
      </View>
      <WebView
        source={{ uri: config.url }}
        style={styles.webview}
        javaScriptEnabled
        userAgent="WorkFix/1.0 Mobile"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  back:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  back_icon: { fontSize: 22, color: Colors.black },
  title:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  webview:   { flex: 1 },
})
