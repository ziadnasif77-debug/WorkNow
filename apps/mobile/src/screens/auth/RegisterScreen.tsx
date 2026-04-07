// ─────────────────────────────────────────────────────────────────────────────
// Register Screen — email/password + name, then role selection
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import { Analytics } from '../../lib/analytics'
import { Button, Input, Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme'

import { isValidEmail } from '@workfix/utils'

type Step = 'credentials' | 'role'
type Role = 'customer' | 'provider'

export default function RegisterScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { signUpEmail, completeProfile, isLoading, error, clearError } = useAuthStore()

  const [step,     setStep]     = useState<Step>('credentials')
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState<Role>('customer')
  const [formErr,  setFormErr]  = useState<Record<string, string>>({})

  function validateCredentials(): boolean {
    const errs: Record<string, string> = {}
    if (name.trim().length < 2)   errs['name']     = t('errors.nameTooShort')
    if (!isValidEmail(email))      errs['email']    = t('errors.invalidEmail')
    if (password.length < 8)       errs['password'] = t('errors.passwordTooShort')
    setFormErr(errs)
    return Object.keys(errs).length === 0
  }

  async function handleNext() {
    clearError()
    if (step === 'credentials') {
      if (!validateCredentials()) return
      setStep('role')
    } else {
      try {
        await signUpEmail(email.trim(), password)
        await completeProfile({ displayName: name.trim(), preferredLang: 'ar' })
        Analytics.signUpComplete(role)
        if (role === 'provider') {
          router.replace('/auth/provider-type')
        } else {
          router.replace('/(tabs)')
        }
      } catch { /* error in store */ }
    }
  }

  return (
    <Screen scroll avoidKeyboard>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>WorkFix</Text>
        <Text style={styles.title}>{t('auth.registerTitle')}</Text>
      </View>

      {/* Step indicator */}
      <View style={styles.steps}>
        <View style={[styles.step_dot, styles.step_dot_active]} />
        <View style={styles.step_line} />
        <View style={[styles.step_dot, step === 'role' && styles.step_dot_active]} />
      </View>

      {step === 'credentials' ? (
        <View style={styles.form}>
          <Input
            label={t('auth.name')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            error={formErr['name']}
            placeholder={t('auth.namePlaceholder')}
          />
          <Input
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={formErr['email']}
            placeholder="name@example.com"
          />
          <Input
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
            error={formErr['password']}
            placeholder="••••••••"
            hint={t('auth.passwordHint')}
          />
        </View>
      ) : (
        <View style={styles.role_section}>
          <Text style={styles.role_title}>{t('auth.iam')}</Text>
          {([
            { key: 'customer', emoji: '👤', desc: t('auth.customer') },
            { key: 'provider', emoji: '🔧', desc: t('auth.provider') },
          ] as const).map(r => (
            <TouchableOpacity
              key={r.key}
              style={[styles.role_card, role === r.key && styles.role_card_active]}
              onPress={() => setRole(r.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.role_emoji}>{r.emoji}</Text>
              <Text style={[styles.role_desc, role === r.key && styles.role_desc_active]}>
                {r.desc}
              </Text>
              <View style={[styles.radio, role === r.key && styles.radio_active]}>
                {role === r.key && <View style={styles.radio_inner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error && (
        <View style={styles.error_box}>
          <Text style={styles.error_text}>{error}</Text>
        </View>
      )}

      <Button
        label={step === 'credentials' ? t('common.next') : t('auth.createAccount')}
        onPress={handleNext}
        isLoading={isLoading}
        style={styles.btn}
      />

      {step === 'credentials' && (
        <View style={styles.footer}>
          <Text style={styles.footer_text}>{t('auth.alreadyHaveAccount')} </Text>
          <TouchableOpacity onPress={() => router.replace('/auth/login')}>
            <Text style={styles.footer_link}>{t('auth.loginTitle')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: Spacing.xxl, paddingBottom: Spacing.lg, gap: 6 },
  logo:   { fontSize: 28, fontWeight: FontWeight.bold, color: Colors.primary },
  title:  { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },

  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl, gap: 0 },
  step_dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.gray200 },
  step_dot_active: { backgroundColor: Colors.primary },
  step_line: { width: 48, height: 2, backgroundColor: Colors.gray200 },

  form: { gap: 0 },

  role_section: { gap: Spacing.md, marginBottom: Spacing.lg },
  role_title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: Spacing.sm },
  role_card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  role_card_active: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  role_emoji: { fontSize: 28 },
  role_desc:  { flex: 1, fontSize: FontSize.md, color: Colors.gray700, fontWeight: FontWeight.medium },
  role_desc_active: { color: Colors.primary },
  radio: {
    width: 22, height: 22, borderRadius: Radius.full,
    borderWidth: 2, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  radio_active: { borderColor: Colors.primary },
  radio_inner:  { width: 10, height: 10, borderRadius: Radius.full, backgroundColor: Colors.primary },

  error_box: {
    backgroundColor: Colors.errorLight, borderRadius: Radius.sm,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  error_text: { color: Colors.error, fontSize: FontSize.sm },

  btn:    { marginVertical: Spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center', paddingBottom: Spacing.xl },
  footer_text: { color: Colors.gray500, fontSize: FontSize.md },
  footer_link: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
})
