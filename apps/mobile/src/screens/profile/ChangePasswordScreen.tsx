// ─────────────────────────────────────────────────────────────────────────────
// Change Password Screen
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  updatePassword, reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth'
import { firebaseAuth } from '../../lib/firebase'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Button, Input, Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'

export default function ChangePasswordScreen() {
  const { t }   = useTranslation()
  const router  = useRouter()

  const [current,  setCurrent]  = useState('')
  const [next,     setNext]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState<Record<string, string>>({})

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (current.length < 6)         e['current'] = 'كلمة المرور الحالية قصيرة'
    if (next.length < 8)            e['next']    = t('errors.passwordTooShort')
    if (next !== confirm)           e['confirm'] = 'كلمتا المرور غير متطابقتان'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleChange() {
    if (!validate()) return
    const user = firebaseAuth.currentUser
    if (!user || !user.email) return

    setLoading(true)
    try {
      const cred = EmailAuthProvider.credential(user.email, current)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, next)
      Alert.alert('✓', 'تم تغيير كلمة المرور بنجاح', [
        { text: t('common.done'), onPress: () => router.back() },
      ])
    } catch (err) {
      const msg = (err as { code?: string }).code === 'auth/wrong-password'
        ? 'كلمة المرور الحالية غير صحيحة'
        : 'فشل تغيير كلمة المرور'
      Alert.alert(t('common.error'), msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen avoidKeyboard padded={false}>
      <ScreenHeader title={t('profile.changePassword')} />

      <View style={styles.content}>
        <Input
          label="كلمة المرور الحالية"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          error={errors['current']}
        />
        <Input
          label="كلمة المرور الجديدة"
          value={next}
          onChangeText={setNext}
          secureTextEntry
          error={errors['next']}
          hint={t('auth.passwordHint')}
        />
        <Input
          label="تأكيد كلمة المرور"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          error={errors['confirm']}
        />
        <Button label="تغيير كلمة المرور" onPress={handleChange} isLoading={loading} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  content: { padding: Spacing.lg, gap: Spacing.sm },
})
