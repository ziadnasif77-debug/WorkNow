// ─────────────────────────────────────────────────────────────────────────────
// OTP Screen — verify phone number
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import { Button, OtpInput, Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'

const RESEND_SECONDS = 60

export default function OtpScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { phone } = useLocalSearchParams<{ phone: string }>()
  const { confirmPhoneOtp, sendPhoneOtp, isLoading, error, clearError } = useAuthStore()

  const [otp,        setOtp]        = useState('')
  const [countdown,  setCountdown]  = useState(RESEND_SECONDS)
  const [canResend,  setCanResend]  = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    startCountdown()
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  function startCountdown() {
    setCountdown(RESEND_SECONDS)
    setCanResend(false)
    intervalRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(intervalRef.current!)
          setCanResend(true)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  async function handleVerify() {
    if (otp.length < 6) return
    clearError()
    try {
      await confirmPhoneOtp(otp)
      // Auth state change → router handles redirect to complete-profile or home
    } catch {
      setOtp('')
    }
  }

  async function handleResend() {
    if (!canResend || !phone) return
    clearError()
    try {
      await sendPhoneOtp(phone)
      setOtp('')
      startCountdown()
    } catch { /* error shown from store */ }
  }

  return (
    <Screen avoidKeyboard>
      <View style={styles.container}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.back_text}>← {t('common.back')}</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>📱</Text>
          <Text style={styles.title}>{t('auth.otp')}</Text>
          <Text style={styles.subtitle}>
            {t('auth.otpSent', { phone: phone ?? '' })}
          </Text>
        </View>

        {/* OTP boxes */}
        <View style={styles.otp_wrap}>
          <OtpInput
            value={otp}
            onChange={v => { setOtp(v); clearError() }}
            error={error ?? undefined}
          />
        </View>

        {/* Verify button */}
        <Button
          label={t('auth.verify')}
          onPress={handleVerify}
          isLoading={isLoading}
          disabled={otp.length < 6}
          style={styles.btn}
        />

        {/* Resend */}
        <View style={styles.resend_row}>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resend_link}>{t('auth.resendOtp')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resend_timer}>
              {t('auth.resendIn', { seconds: countdown })}
            </Text>
          )}
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.lg },
  back:      { paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  back_text: { color: Colors.primary, fontSize: FontSize.md },

  header: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emoji:  { fontSize: 56 },
  title:  { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },
  subtitle: { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center', lineHeight: 22 },

  otp_wrap: { paddingVertical: Spacing.xl },
  btn:      { marginBottom: Spacing.lg },

  resend_row:  { alignItems: 'center' },
  resend_link: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  resend_timer: { color: Colors.gray400, fontSize: FontSize.md },
})
