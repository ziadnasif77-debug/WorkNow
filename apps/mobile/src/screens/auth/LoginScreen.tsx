// ─────────────────────────────────────────────────────────────────────────────
// Login Screen — Email or Phone, Google sign-in
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import { Analytics } from '../../lib/analytics'
import { Button, Input, Divider, Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize } from '../../constants/theme'
import { isValidEmail, isValidPhone } from '@workfix/utils'

// expo-firebase-recaptcha provides a native-compatible ApplicationVerifier.
// It renders an invisible modal that handles reCAPTCHA for iOS/Android.
// Import lazily so the app doesn't crash if the package is missing in Expo Go.
let FirebaseRecaptchaVerifierModal: React.ComponentType<{
  ref: React.Ref<unknown>
  firebaseConfig: Record<string, unknown>
  attemptInvisibleVerification?: boolean
}> | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  FirebaseRecaptchaVerifierModal = (require('expo-firebase-recaptcha') as {
    FirebaseRecaptchaVerifierModal: typeof FirebaseRecaptchaVerifierModal
  }).FirebaseRecaptchaVerifierModal
} catch { /* package not installed — phone OTP will warn gracefully */ }

type Tab = 'email' | 'phone'

export default function LoginScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { signInEmail, sendPhoneOtp, setRecaptchaVerifier, isLoading, error, clearError } = useAuthStore()

  const recaptchaRef = useRef<unknown>(null)

  const [tab,      setTab]      = useState<Tab>('phone')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [phone,    setPhone]    = useState('')
  const [formErr,  setFormErr]  = useState<{ email?: string; password?: string; phone?: string }>({})

  function validate(): boolean {
    const errs: typeof formErr = {}
    if (tab === 'email') {
      if (!isValidEmail(email))   errs.email    = t('errors.invalidEmail')
      if (password.length < 6)    errs.password = t('errors.passwordTooShort')
    } else {
      if (!isValidPhone(phone))   errs.phone    = t('errors.invalidPhone')
    }
    setFormErr(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    clearError()
    if (!validate()) return

    try {
      if (tab === 'email') {
        await signInEmail(email.trim(), password)
        Analytics.login('email')
      } else {
        // Inject the reCAPTCHA verifier before calling sendPhoneOtp
        if (recaptchaRef.current) {
          setRecaptchaVerifier(recaptchaRef.current)
        } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
          // Web fallback — RecaptchaVerifier created inline
          const { RecaptchaVerifier } = await import('firebase/auth')
          const { firebaseAuth } = await import('../../lib/firebase')
          const webVerifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', { size: 'invisible' })
          setRecaptchaVerifier(webVerifier)
        }
        await sendPhoneOtp(phone.trim())
        Analytics.signUpStart('phone')
        router.push({ pathname: '/auth/otp', params: { phone: phone.trim() } })
      }
    } catch {
      // error is set in store
    }
  }

  return (
    <Screen scroll avoidKeyboard>
      {/* reCAPTCHA modal — renders invisibly on native, no-op on web */}
      {FirebaseRecaptchaVerifierModal && (
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaRef}
          firebaseConfig={
            (require('../../lib/firebase') as { firebaseApp: { options: Record<string, unknown> } })
              .firebaseApp.options
          }
          attemptInvisibleVerification
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>WorkFix</Text>
        <Text style={styles.title}>{t('auth.loginTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.tagline')}</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        {(['phone', 'email'] as Tab[]).map(tp => (
          <TouchableOpacity
            key={tp}
            style={[styles.tab, tab === tp && styles.tab_active]}
            onPress={() => { setTab(tp); setFormErr({}); clearError() }}
          >
            <Text style={[styles.tab_label, tab === tp && styles.tab_label_active]}>
              {tp === 'phone' ? t('auth.phone') : t('auth.email')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Form */}
      <View style={styles.form}>
        {tab === 'email' ? (
          <>
            <Input
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={formErr.email}
              placeholder="name@example.com"
            />
            <Input
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              error={formErr.password}
              placeholder="••••••••"
            />
            <TouchableOpacity
              onPress={() => router.push('/auth/forgot-password')}
              style={styles.forgot}
            >
              <Text style={styles.forgot_text}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Input
            label={t('auth.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            error={formErr.phone}
            placeholder="+966 5X XXX XXXX"
            hint={t('auth.phoneHint')}
          />
        )}

        {/* Global error */}
        {error && (
          <View style={styles.error_box}>
            <Text style={styles.error_text}>{error}</Text>
          </View>
        )}

        <Button
          label={tab === 'phone' ? t('auth.sendOtp') : t('auth.loginTitle')}
          onPress={handleSubmit}
          isLoading={isLoading}
          style={styles.submit_btn}
        />

        <Divider label={t('auth.orContinueWith')} />

        {/* Google */}
        <Button
          label={t('auth.google')}
          onPress={async () => {
              // Google Sign-In: implement with expo-auth-session
              // See: https://docs.expo.dev/guides/google-authentication/
              Alert.alert('قريباً', 'تسجيل الدخول بـ Google قيد التطوير')
            }}
          variant="outline"
          icon={<Text style={{ fontSize: IconSize.sm }}>G</Text>}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footer_text}>{t('auth.noAccount')} </Text>
        <TouchableOpacity onPress={() => router.push('/auth/register')}>
          <Text style={styles.footer_link}>{t('auth.registerTitle')}</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: Spacing.xxl, paddingBottom: Spacing.xl, gap: 6 },
  logo:   { fontSize: 28, fontWeight: FontWeight.bold, color: Colors.primary, letterSpacing: -0.5 },
  title:  { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },
  subtitle: { fontSize: FontSize.md, color: Colors.gray500 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.sm },
  tab_active: { backgroundColor: Colors.white },
  tab_label:  { fontSize: FontSize.md, color: Colors.gray500, fontWeight: FontWeight.medium },
  tab_label_active: { color: Colors.primary, fontWeight: FontWeight.bold },

  form:       { gap: 0 },
  forgot:     { alignSelf: 'flex-end', marginBottom: Spacing.sm },
  forgot_text: { fontSize: FontSize.sm, color: Colors.primary },
  submit_btn: { marginTop: Spacing.sm, marginBottom: Spacing.md },

  error_box: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  error_text: { color: Colors.error, fontSize: FontSize.sm },

  footer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: Spacing.xl },
  footer_text: { color: Colors.gray500, fontSize: FontSize.md },
  footer_link: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
})
