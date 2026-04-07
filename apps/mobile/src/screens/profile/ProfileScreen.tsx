// ─────────────────────────────────────────────────────────────────────────────
// Profile Screen — user info, language switcher, sign out
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Switch, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import { useAuth } from '../../hooks/useAuth'
import { changeLanguage } from '../../lib/i18n'
import { Colors, Spacing, FontSize, FontWeight, Radius, IconSize, AvatarSize } from '../../constants/theme'
import type { SupportedLocale } from '@workfix/types'

const LANGUAGES: Array<{ code: SupportedLocale; label: string; flag: string }> = [
  { code: 'ar', label: 'العربية',   flag: '🇸🇦' },
  { code: 'en', label: 'English',   flag: '🇬🇧' },
  { code: 'no', label: 'Norsk',     flag: '🇳🇴' },
  { code: 'sv', label: 'Svenska',   flag: '🇸🇪' },
]

export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const router      = useRouter()
  const { firebaseUser } = useAuthStore()
  const { role, isProvider, signOut } = useAuth()

  const [langChanging, setLangChanging] = useState(false)
  const currentLang = (i18n.language ?? 'ar') as SupportedLocale

  async function handleLanguageChange(lang: SupportedLocale) {
    if (lang === currentLang || langChanging) return
    setLangChanging(true)
    try {
      await changeLanguage(lang)
      // App reloads if direction changes (ar ↔ others)
    } finally {
      setLangChanging(false)
    }
  }

  async function handleSignOut() {
    try {
    Alert.alert(
      t('profile.signOutTitle'),
      t('profile.signOutDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.signOut'),
          style: 'destructive',
          onPress: async () => {
            await signOut()
            router.replace('/auth/login')
          } },
      ],
    )
      } catch (err) {
      if (__DEV__) console.warn('[Profile] signOut error', err)
    }
  }

  const displayName = firebaseUser?.displayName ?? t('profile.anonymous')
  const email       = firebaseUser?.email
  const initials    = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Avatar + name ─────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.avatar_wrap}>
          {firebaseUser?.photoURL ? (
            <Image source={{ uri: firebaseUser.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar_placeholder}>
              <Text style={styles.avatar_initials}>{initials}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.edit_avatar} onPress={() => router.push('/profile/edit-photo')}>
            <Text style={styles.edit_avatar_icon}>✏️</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.display_name}>{displayName}</Text>
        {email && <Text style={styles.email}>{email}</Text>}
        <View style={styles.role_chip}>
          <Text style={styles.role_text}>
            {role === 'provider' ? `🔧 ${t('auth.provider')}` : `👤 ${t('auth.customer')}`}
          </Text>
        </View>
      </View>

      {/* ── Provider section ──────────────────────────────────────────── */}
      {isProvider && (
        <SectionCard title={t('profile.providerTools')}>
          <MenuRow emoji="💼" label={t('profile.myServices')}    onPress={() => router.push('/profile/services')} />
          <MenuRow emoji="⭐" label={t('subscriptions.title')}   onPress={() => router.push('/subscriptions')} />
          <MenuRow emoji="💳" label={t('provider.wallet')}       onPress={() => router.push('/wallet')} />
          <MenuRow emoji="📊" label={t('profile.statistics')}    onPress={() => router.push('/profile/stats')} />
          <MenuRow emoji="🏦" label={t('provider.bankAccount')}  onPress={() => router.push('/profile/bank-account')} />
        </SectionCard>
      )}

      {/* ── Account ───────────────────────────────────────────────────── */}
      <SectionCard title={t('profile.account')}>
        <MenuRow emoji="👤" label={t('profile.editProfile')}   onPress={() => router.push('/profile/edit')} />
        <MenuRow emoji="🔒" label={t('profile.changePassword')} onPress={() => router.push('/profile/change-password')} />
        <MenuRow emoji="🔔" label={t('profile.notifications')} onPress={() => router.push('/notifications')} />
      </SectionCard>

      {/* ── Language ──────────────────────────────────────────────────── */}
      <SectionCard title={t('profile.language')}>
        <View style={styles.lang_grid}>
          {LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.lang_chip, currentLang === lang.code && styles.lang_chip_active]}
              onPress={() => handleLanguageChange(lang.code)}
              disabled={langChanging}
            >
              <Text style={styles.lang_flag}>{lang.flag}</Text>
              <Text style={[styles.lang_label, currentLang === lang.code && styles.lang_label_active]}>
                {lang.label}
              </Text>
              {currentLang === lang.code && <Text style={styles.lang_check}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.lang_hint}>{t('profile.languageHint')}</Text>
      </SectionCard>

      {/* ── Support ───────────────────────────────────────────────────── */}
      <SectionCard title={t('profile.support')}>
        <MenuRow emoji="❓" label={t('profile.faq')}         onPress={() => router.push('/support/faq')} />
        <MenuRow emoji="📧" label={t('profile.contactUs')}   onPress={() => router.push('/support/contact')} />
        <MenuRow emoji="⭐" label={t('profile.rateApp')}     onPress={() => { /* StoreReview */ }} />
        <MenuRow emoji="📄" label={t('profile.terms')}       onPress={() => router.push('/support/terms')} />
        <MenuRow emoji="🔐" label={t('profile.privacy')}     onPress={() => router.push('/support/privacy')} />
        <MenuRow emoji="🛡️" label={t('privacy.screenTitle', 'الخصوصية وبياناتي')} onPress={() => router.push('/profile/privacy')} />
      </SectionCard>

      {/* ── Danger zone ───────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.signout_btn} onPress={handleSignOut}>
        <Text style={styles.signout_icon}>🚪</Text>
        <Text style={styles.signout_label}>{t('profile.signOut')}</Text>
      </TouchableOpacity>

      <Text style={styles.version}>WorkFix v1.0.0</Text>

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  )
}

// ── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.card}>{children}</View>
    </View>
  )
}

const sectionStyles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  title:     { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray500, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  card:      { backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border } })

// ── Menu row ─────────────────────────────────────────────────────────────────

function MenuRow({
  emoji, label, onPress, rightEl }: {
  emoji:    string
  label:    string
  onPress?: () => void
  rightEl?: React.ReactNode
}) {
  return (
    <TouchableOpacity
      style={menuStyles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <Text style={menuStyles.emoji}>{emoji}</Text>
      <Text style={menuStyles.label}>{label}</Text>
      {rightEl ?? <Text style={menuStyles.arrow}>›</Text>}
    </TouchableOpacity>
  )
}

const menuStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  emoji: { fontSize: IconSize.md, width: 28, textAlign: 'center' },
  label: { flex: 1, fontSize: FontSize.md, color: Colors.black },
  arrow: { fontSize: IconSize.md, color: Colors.gray300 } })

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  hero: {
    alignItems: 'center', paddingVertical: Spacing.xl,
    backgroundColor: Colors.white, marginBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar_wrap:        { position: 'relative', marginBottom: Spacing.md },
  avatar:             { width: AvatarSize.xxl, height: AvatarSize.xxl, borderRadius: Radius.full },
  avatar_placeholder: {
    width: AvatarSize.xxl, height: AvatarSize.xxl, borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center' },
  avatar_initials: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.primary },
  edit_avatar: {
    position: 'absolute', bottom: 0, right: 0,
    width: AvatarSize.xs, height: AvatarSize.xs, borderRadius: Radius.full,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center' },
  edit_avatar_icon: { fontSize: IconSize.sm },
  display_name:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  email:            { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4 },
  role_chip: {
    marginTop: Spacing.sm, backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  role_text: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },

  lang_grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.md },
  lang_chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white },
  lang_chip_active:  { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  lang_flag:         { fontSize: IconSize.md },
  lang_label:        { fontSize: FontSize.sm, color: Colors.gray700, fontWeight: FontWeight.medium },
  lang_label_active: { color: Colors.primary, fontWeight: FontWeight.bold },
  lang_check:        { fontSize: IconSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  lang_hint:         { fontSize: FontSize.xs, color: Colors.gray400, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },

  signout_btn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
    backgroundColor: Colors.errorLight, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.error + '40' },
  signout_icon:  { fontSize: IconSize.md },
  signout_label: { fontSize: FontSize.md, color: Colors.error, fontWeight: FontWeight.bold },

  version: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.gray300, marginTop: Spacing.lg } })
