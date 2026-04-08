// ─────────────────────────────────────────────────────────────────────────────
// Payment Success Screen — shown after Tap callback confirms payment
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Analytics } from '../../lib/analytics'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize } from '../../constants/theme'

export default function PaymentSuccessScreen() {
  const { t }       = useTranslation()
  const router      = useRouter()
  const insets      = useSafeAreaInsets()
  const { orderId } = useLocalSearchParams<{ orderId: string }>()

  // Fire payment complete event once
  React.useEffect(() => {
    if (orderId) Analytics.paymentComplete(orderId, 0, 'SAR')
  }, [])

  // Entrance animation
  const scaleAnim   = useRef(new Animated.Value(0)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1, tension: 60, friction: 8, useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Success icon */}
      <Animated.View style={[styles.icon_wrap, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.icon_circle}>
          <Text style={styles.icon}>✓</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.content, { opacity: opacityAnim }]}>
        <Text style={styles.title}>{t('payment.success')}</Text>
        <Text style={styles.subtitle}>{t('payment.successDesc')}</Text>

        {/* Escrow explanation */}
        <View style={styles.escrow_card}>
          <Text style={styles.escrow_title}>🔒 {t('payment.escrowTitle')}</Text>
          <View style={styles.escrow_steps}>
            {[
              t('payment.escrowStep1'),
              t('payment.escrowStep2'),
              t('payment.escrowStep3'),
            ].map((step, i) => (
              <View key={i} style={styles.escrow_step}>
                <View style={styles.escrow_num}>
                  <Text style={styles.escrow_num_text}>{i + 1}</Text>
                </View>
                <Text style={styles.escrow_step_text}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Actions */}
        <Button
          label={t('payment.trackOrder')}
          onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: orderId } })}
          style={styles.btn}
        />
        <Button
          label={t('home.backHome')}
          onPress={() => router.replace('/(tabs)')}
          variant="ghost"
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl,
  },
  icon_wrap: { marginBottom: Spacing.xl },
  icon_circle: {
    width: 96, height: 96, borderRadius: Radius.full,
    backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: IconSize.xxl, color: Colors.white, fontWeight: FontWeight.bold },

  content: { width: '100%', alignItems: 'center', gap: Spacing.md },
  title:    { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.black, textAlign: 'center' },
  subtitle: { fontSize: FontSize.lg, color: Colors.gray500, textAlign: 'center', lineHeight: 24 },

  escrow_card: {
    width: '100%', backgroundColor: Colors.white,
    borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  escrow_title: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  escrow_steps: { gap: Spacing.md },
  escrow_step:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  escrow_num: {
    width: 24, height: 24, borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  escrow_num_text:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  escrow_step_text: { flex: 1, fontSize: FontSize.sm, color: Colors.gray600, lineHeight: 20 },

  btn: { width: '100%', marginTop: Spacing.sm },
})
