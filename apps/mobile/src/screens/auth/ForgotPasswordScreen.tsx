// ─────────────────────────────────────────────────────────────────────────────
// Forgot Password Screen — send reset email via Firebase Auth
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { sendPasswordResetEmail } from 'firebase/auth'
import { firebaseAuth } from '../../lib/firebase'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Button, Input, Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, IconSize } from '../../constants/theme'
import { isValidEmail } from '@workfix/utils'

export default function ForgotPasswordScreen() {
  const { t }   = useTranslation()
  const router  = useRouter()

  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [emailErr, setEmailErr] = useState('')

  async function handleReset() {
    if (!isValidEmail(email)) { setEmailErr(t('errors.invalidEmail')); return }
    setLoading(true)
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim())
      setSent(true)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/user-not-found') {
        setEmailErr('لا يوجد حساب بهذا البريد')
      } else {
        Alert.alert(t('common.error'), 'فشل إرسال الرسالة. حاول لاحقاً.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen avoidKeyboard padded={false}>
      <ScreenHeader title={t('auth.forgotPassword')} />

      {sent ? (
        <View style={styles.success_container}>
          <Text style={styles.success_emoji}>📧</Text>
          <Text style={styles.success_title}>تحقق من بريدك</Text>
          <Text style={styles.success_body}>
            أرسلنا رابط إعادة تعيين كلمة المرور إلى {email}
          </Text>
          <Button
            label="العودة لتسجيل الدخول"
            onPress={() => router.replace('/auth/login')}
          />
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.title}>نسيت كلمة المرور؟</Text>
          <Text style={styles.subtitle}>
            أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
          </Text>

          <Input
            label={t('auth.email')}
            value={email}
            onChangeText={v => { setEmail(v); setEmailErr('') }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={emailErr}
            placeholder="name@example.com"
          />

          <Button
            label="إرسال رابط إعادة التعيين"
            onPress={handleReset}
            isLoading={loading}
          />
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  form: { padding: Spacing.lg, gap: Spacing.md, paddingTop: Spacing.xl },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },
  subtitle: { fontSize: FontSize.md, color: Colors.gray500, lineHeight: 22 },
  success_container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, gap: Spacing.lg,
  },
  success_emoji: { fontSize: IconSize.xxxl },
  success_title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black, textAlign: 'center' },
  success_body:  { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center', lineHeight: 24 },
})
