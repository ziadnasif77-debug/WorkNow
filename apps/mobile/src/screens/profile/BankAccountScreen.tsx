// ─────────────────────────────────────────────────────────────────────────────
// Bank Account Screen — provider enters IBAN for payouts
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { usePaymentsStore } from '../../stores/paymentsStore'
import { firebaseAuth } from '../../lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Button, Input, Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize } from '../../constants/theme'

export default function BankAccountScreen() {
  const { t }   = useTranslation()
  const router  = useRouter()
  const uid     = firebaseAuth.currentUser?.uid

  const [iban,      setIban]      = useState('')
  const [bankName,  setBankName]  = useState('')
  const [accName,   setAccName]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [fetching,  setFetching]  = useState(true)
  const [ibanErr,   setIbanErr]   = useState('')

  useEffect(() => {
    if (!uid) return
    void getDoc(doc(firestore, 'providerProfiles', uid)).then(snap => {
      const data = snap.data()?.['bankAccount'] as Record<string, string> | undefined
      if (data) {
        setIban(data['iban'] ?? '')
        setBankName(data['bankName'] ?? '')
        setAccName(data['accountName'] ?? '')
      }
      setFetching(false)
    })
  }, [uid])

  function validateIban(value: string): boolean {
    // Basic IBAN: SA + 22 digits
    const cleaned = value.replace(/\s/g, '').toUpperCase()
    if (cleaned.startsWith('SA') && cleaned.length === 24) return true
    // Also allow NO (15) and SE (22)
    if (cleaned.startsWith('NO') && cleaned.length === 15) return true
    if (cleaned.startsWith('SE') && cleaned.length === 22) return true
    return false
  }

  async function handleSave() {
    const cleaned = iban.replace(/\s/g, '').toUpperCase()
    if (!validateIban(cleaned)) {
      setIbanErr('رقم الآيبان غير صحيح')
      return
    }
    if (accName.trim().length < 3) {
      Alert.alert(t('common.error'), 'يرجى إدخال اسم صاحب الحساب')
      return
    }

    setLoading(true)
    try {
      const { saveBankAccount } = usePaymentsStore.getState()
      await saveBankAccount({
        iban:        cleaned,
        bankName:    bankName.trim(),
        accountHolder: accName.trim(),
      })
      Alert.alert('✓', 'تم حفظ معلومات الحساب البنكي', [
        { text: t('common.done'), onPress: () => router.back() },
      ])
    } catch {
      Alert.alert(t('common.error'), 'فشل الحفظ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen scroll avoidKeyboard padded={false}>
      <ScreenHeader title={t('provider.bankAccount')} />

      <View style={styles.content}>
        <View style={styles.info_box}>
          <Text style={styles.info_icon}>🔒</Text>
          <Text style={styles.info_text}>
            معلوماتك البنكية مشفرة وآمنة. تُستخدم فقط لتحويل أرباحك.
          </Text>
        </View>

        <Input
          label="رقم الآيبان (IBAN)"
          value={iban}
          onChangeText={v => { setIban(v); setIbanErr('') }}
          placeholder="SA00 0000 0000 0000 0000 0000"
          autoCapitalize="characters"
          error={ibanErr}
          hint="مثال: SA29 0000 0000 0000 0000 0000 (24 رقماً)"
        />

        <Input
          label="اسم البنك"
          value={bankName}
          onChangeText={setBankName}
          placeholder="مثال: البنك الأهلي"
        />

        <Input
          label="اسم صاحب الحساب"
          value={accName}
          onChangeText={setAccName}
          placeholder="الاسم كما يظهر في البطاقة"
          autoCapitalize="words"
        />

        <Button label="حفظ المعلومات البنكية" onPress={handleSave} isLoading={loading} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },
  info_box: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md,
  },
  info_icon: { fontSize: IconSize.md },
  info_text: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, lineHeight: 20 },
})
