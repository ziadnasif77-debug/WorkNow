// ─────────────────────────────────────────────────────────────────────────────
// Edit Profile Screen — update display name, avatar, bio
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import { firebaseAuth } from '../../lib/firebase'
import { useImageUpload } from '../../hooks/useImageUpload'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Button, Input, Screen } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'

export default function EditProfileScreen() {
  const { t }   = useTranslation()
  const router  = useRouter()
  const user    = firebaseAuth.currentUser
  const upload  = useImageUpload('avatars')

  const [name,      setName]      = useState(user?.displayName ?? '')
  const [bio,       setBio]       = useState('')
  const [avatarUrl, setAvatarUrl] = useState(user?.photoURL ?? null)
  const [isLoading, setIsLoading] = useState(false)
  const [nameErr,   setNameErr]   = useState('')

  async function handleSave() {
    if (name.trim().length < 2) { setNameErr(t('errors.nameTooShort')); return }
    setIsLoading(true)
    try {
      await updateProfile(user, { displayName: name.trim(), photoURL: avatarUrl ?? undefined })
      await updateDoc(doc(firestore, 'users', user.uid), {
        displayName: name.trim(), avatarUrl, bio: bio.trim() || null, updatedAt: new Date() })
      router.back()
    } catch {
      Alert.alert(t('common.error'), 'فشل التحديث')
    } finally {
      setIsLoading(false)
    }
  }

  async function handlePickAvatar() {
    try {
      const url = await upload.pickAndUpload()
      if (url) setAvatarUrl(url)
    } catch (err) {
      if (__DEV__) console.warn('[EditProfile] avatar upload error', err)
    }
  }

  const initials = (user?.displayName ?? '?').slice(0, 2).toUpperCase()

  return (
    <Screen scroll avoidKeyboard padded={false}>
      <ScreenHeader title={t('profile.editProfile')} />

      <View style={styles.content}>
        {/* Avatar */}
        <TouchableOpacity style={styles.avatar_wrap} onPress={handlePickAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatar_placeholder]}>
              <Text style={styles.avatar_initials}>{initials}</Text>
            </View>
          )}
          <View style={styles.avatar_edit}>
            {upload.isUploading
              ? <Text style={styles.avatar_edit_icon}>⏳</Text>
              : <Text style={styles.avatar_edit_icon}>✏️</Text>
            }
          </View>
        </TouchableOpacity>

        <Input
          label={t('auth.name')}
          value={name}
          onChangeText={v => { setName(v); setNameErr('') }}
          error={nameErr}
          autoCapitalize="words"
        />

        <Input
          label="نبذة عنك"
          value={bio}
          onChangeText={setBio}
          placeholder="اكتب نبذة قصيرة عنك..."
          multiline
          hint="اختياري"
        />

        <Button label={t('common.done')} onPress={handleSave} isLoading={isLoading} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  content: { padding: Spacing.lg, gap: Spacing.md, alignItems: 'center' },
  avatar_wrap: { position: 'relative', marginBottom: Spacing.md },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatar_placeholder: {
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatar_initials: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.primary },
  avatar_edit: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center' },
  avatar_edit_icon: { fontSize: 14 } })
