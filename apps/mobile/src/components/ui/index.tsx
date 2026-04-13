// ─────────────────────────────────────────────────────────────────────────────
// UI Kit — shared components for all screens
// Source of truth: apps/mobile/src/constants/theme.ts + DESIGN.md
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
  StyleSheet,
  type ViewStyle, type TextStyle, type TextInputProps, type ImageSourcePropType,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Colors, Spacing, Radius, FontSize, FontWeight, Shadow, IconSize, AvatarSize,
} from '../../constants/theme'

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON
// variants: primary | outline | ghost | danger | success | destructive
// ─────────────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'success' | 'destructive'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps {
  label:               string
  onPress:             () => void
  variant?:            ButtonVariant
  size?:               ButtonSize
  isLoading?:          boolean
  disabled?:           boolean
  style?:              ViewStyle
  icon?:               React.ReactNode
  fullWidth?:          boolean
  accessibilityLabel?: string
  accessibilityHint?:  string
}

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  isLoading, disabled, style, icon, fullWidth = true,
  accessibilityLabel, accessibilityHint,
}: ButtonProps) {
  const isDisabled = disabled || isLoading

  return (
    <TouchableOpacity
      style={[
        btn.base,
        btn[variant],
        btn[`size_${size}`],
        fullWidth && btn.full,
        isDisabled && btn.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? Colors.white : Colors.primary}
          size="small"
        />
      ) : (
        <View style={btn.inner}>
          {icon && <View style={btn.icon_wrap}>{icon}</View>}
          <Text style={[btn.label, btn[`label_${variant}`], btn[`label_${size}`]]}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const btn = StyleSheet.create({
  base:        { borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  inner:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  icon_wrap:   { width: IconSize.md, height: IconSize.md, alignItems: 'center', justifyContent: 'center' },
  full:        { width: '100%' as any },
  disabled:    { opacity: 0.5 },

  primary:     { backgroundColor: Colors.primary, ...Shadow.sm },
  outline:     { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  ghost:       { backgroundColor: 'transparent' },
  danger:      { backgroundColor: Colors.error },
  success:     { backgroundColor: Colors.successLight, borderWidth: 1, borderColor: Colors.success + '40' },
  destructive: { backgroundColor: Colors.errorLight,   borderWidth: 1, borderColor: Colors.error   + '40' },

  size_sm: { height: 36, paddingHorizontal: Spacing.md },
  size_md: { height: 50, paddingHorizontal: Spacing.lg },
  size_lg: { height: 56, paddingHorizontal: Spacing.xl },

  label:             { fontWeight: FontWeight.bold, letterSpacing: 0.2 },
  label_primary:     { color: Colors.white,   fontSize: FontSize.md },
  label_outline:     { color: Colors.primary, fontSize: FontSize.md },
  label_ghost:       { color: Colors.primary, fontSize: FontSize.md },
  label_danger:      { color: Colors.white,   fontSize: FontSize.md },
  label_success:     { color: Colors.success, fontSize: FontSize.md },
  label_destructive: { color: Colors.error,   fontSize: FontSize.md },
  label_sm:          { fontSize: FontSize.sm },
  label_md:          { fontSize: FontSize.md },
  label_lg:          { fontSize: FontSize.lg },
})

// ─────────────────────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────────────────────

interface InputProps extends TextInputProps {
  label?:          string
  error?:          string
  hint?:           string
  leftIcon?:       React.ReactNode
  rightIcon?:      React.ReactNode
  containerStyle?: ViewStyle
}

export function Input({
  label, error, hint, leftIcon, rightIcon,
  containerStyle, style, ...props
}: InputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <View style={[inp.container, containerStyle]}>
      {label && <Text style={inp.label}>{label}</Text>}
      <View style={[
        inp.wrap,
        focused && inp.wrap_focused,
        !!error && inp.wrap_error,
      ]}>
        {leftIcon  && <View style={inp.icon_left}>{leftIcon}</View>}
        <TextInput
          style={[
            inp.field,
            leftIcon  ? inp.field_with_left  : undefined,
            rightIcon ? inp.field_with_right : undefined,
            style,
          ]}
          placeholderTextColor={Colors.gray400}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {rightIcon && <View style={inp.icon_right}>{rightIcon}</View>}
      </View>
      {error          && <Text style={inp.error}>{error}</Text>}
      {!error && hint && <Text style={inp.hint}>{hint}</Text>}
    </View>
  )
}

const inp = StyleSheet.create({
  container:       { gap: Spacing.xs, marginBottom: Spacing.md },
  label:           { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.gray700 },
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, backgroundColor: Colors.white,
  },
  wrap_focused:    { borderColor: Colors.primary },
  wrap_error:      { borderColor: Colors.error },
  field: {
    flex: 1, height: 50,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md, color: Colors.black,
  },
  field_with_left:  { paddingStart: 0 },
  field_with_right: { paddingEnd: 0 },
  icon_left:        { paddingStart: Spacing.md, paddingEnd: Spacing.sm },
  icon_right:       { paddingEnd: Spacing.md, paddingStart: Spacing.sm },
  error: { fontSize: FontSize.xs, color: Colors.error,   marginTop: Spacing.xxs },
  hint:  { fontSize: FontSize.xs, color: Colors.gray500, marginTop: Spacing.xxs },
})

// ─────────────────────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────────────────────

interface CardProps {
  children:  React.ReactNode
  style?:    ViewStyle
  padding?:  number
  onPress?:  () => void
}

export function Card({ children, style, padding = Spacing.md, onPress }: CardProps) {
  const cardStyle: ViewStyle[] = [card.base, { padding }, style ?? {}]
  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.9}>
        {children}
      </TouchableOpacity>
    )
  }
  return <View style={cardStyle}>{children}</View>
}

const card = StyleSheet.create({
  base: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.sm,
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// DIVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function Divider({ label, style }: { label?: string; style?: ViewStyle }) {
  if (!label) return <View style={[div.line, style]} />
  return (
    <View style={[div.labeled, style]}>
      <View style={div.rule} />
      <Text style={div.text}>{label}</Text>
      <View style={div.rule} />
    </View>
  )
}

const div = StyleSheet.create({
  line:    { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  labeled: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.md },
  rule:    { flex: 1, height: 1, backgroundColor: Colors.border },
  text:    { fontSize: FontSize.sm, color: Colors.gray400, fontWeight: FontWeight.medium },
})

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN WRAPPER  (safe area + background)
// ─────────────────────────────────────────────────────────────────────────────

interface ScreenProps {
  children:       React.ReactNode
  scroll?:        boolean
  style?:         ViewStyle
  padded?:        boolean
  avoidKeyboard?: boolean
}

export function Screen({ children, scroll, style, padded = true, avoidKeyboard }: ScreenProps) {
  const content = (
    <SafeAreaView style={[scr.root, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={padded ? scr.padded : undefined}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[scr.content, padded && scr.padded]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  )

  if (avoidKeyboard) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {content}
      </KeyboardAvoidingView>
    )
  }
  return content
}

/** Alias kept for readability — identical to Screen */
export const ScreenWrapper = Screen

const scr = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1 },
  padded:  { paddingHorizontal: Spacing.lg },
})

// ─────────────────────────────────────────────────────────────────────────────
// OTP INPUT
// ─────────────────────────────────────────────────────────────────────────────

interface OtpInputProps {
  length?:  number
  value:    string
  onChange: (val: string) => void
  error?:   string
}

export function OtpInput({ length = 6, value, onChange, error }: OtpInputProps) {
  const digits = value.split('').slice(0, length)
  while (digits.length < length) digits.push('')

  return (
    <View>
      <View style={otp.row}>
        {digits.map((d, i) => (
          <View
            key={i}
            style={[
              otp.box,
              d !== '' && otp.box_filled,
              !!error && otp.box_error,
            ]}
          >
            <Text style={otp.digit}>{d}</Text>
          </View>
        ))}
      </View>
      <TextInput
        style={otp.hidden}
        value={value}
        onChangeText={t => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
      />
      {error && <Text style={inp.error}>{error}</Text>}
    </View>
  )
}

const otp = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  box: {
    width: 48, height: 56, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  box_filled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  box_error:  { borderColor: Colors.error },
  digit:      { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  hidden:     { position: 'absolute', opacity: 0, width: 1, height: 1 },
})

// ─────────────────────────────────────────────────────────────────────────────
// BADGE  (status pill)
// ─────────────────────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral' | 'custom'

interface BadgeProps {
  label:    string
  variant?: BadgeVariant
  bg?:      string   // used when variant='custom'
  color?:   string   // used when variant='custom'
  style?:   ViewStyle
}

const BADGE_COLORS: Record<Exclude<BadgeVariant, 'custom'>, { bg: string; text: string }> = {
  success: { bg: Colors.successLight, text: Colors.success },
  warning: { bg: Colors.warningLight, text: Colors.warning },
  error:   { bg: Colors.errorLight,   text: Colors.error },
  info:    { bg: Colors.infoLight,    text: Colors.info },
  primary: { bg: Colors.primaryLight, text: Colors.primary },
  neutral: { bg: Colors.gray100,      text: Colors.gray500 },
}

export function Badge({ label, variant = 'neutral', bg, color, style }: BadgeProps) {
  const colors = variant === 'custom'
    ? { bg: bg ?? Colors.gray100, text: color ?? Colors.gray500 }
    : BADGE_COLORS[variant]

  return (
    <View style={[badge.pill, { backgroundColor: colors.bg }, style]}>
      <Text style={[badge.text, { color: colors.text }]}>{label}</Text>
    </View>
  )
}

const badge = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full, alignSelf: 'flex-start' },
  text: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
})

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────────────────────────────────────

type AvatarSizeKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

interface AvatarProps {
  uri?:       string
  source?:    ImageSourcePropType
  name?:      string          // used to generate initials if no image
  size?:      AvatarSizeKey
  online?:    boolean         // show green online dot
  verified?:  boolean         // show blue verified badge
  style?:     ViewStyle
}

export function Avatar({ uri, source, name, size = 'md', online, verified, style }: AvatarProps) {
  const dim  = AvatarSize[size]
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'
  const fontSize = Math.max(10, Math.round(dim * 0.38))

  const imageSource = source ?? (uri ? { uri } : null)

  return (
    <View style={[{ width: dim, height: dim }, style]}>
      {imageSource ? (
        <Image
          source={imageSource}
          style={[av.image, { width: dim, height: dim }]}
        />
      ) : (
        <View style={[av.placeholder, { width: dim, height: dim }]}>
          <Text style={[av.initials, { fontSize }]}>{initials}</Text>
        </View>
      )}

      {online && (
        <View style={av.online_dot} />
      )}
      {verified && (
        <View style={av.verified_badge}>
          <Text style={av.verified_text}>✓</Text>
        </View>
      )}
    </View>
  )
}

const av = StyleSheet.create({
  image:       { borderRadius: Radius.full },
  placeholder: {
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  initials:     { fontWeight: FontWeight.bold, color: Colors.primary },
  online_dot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: Radius.full,
    backgroundColor: Colors.success,
    borderWidth: 2, borderColor: Colors.white,
  },
  verified_badge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  verified_text: { color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold },
})

// ─────────────────────────────────────────────────────────────────────────────
// CHIP  (selectable tag)
// ─────────────────────────────────────────────────────────────────────────────

interface ChipProps {
  label:      string
  selected?:  boolean
  onPress?:   () => void
  icon?:      React.ReactNode
  style?:     ViewStyle
}

export function Chip({ label, selected, onPress, icon, style }: ChipProps) {
  return (
    <TouchableOpacity
      style={[chip.base, selected && chip.selected, style]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
    >
      {icon && <View>{icon}</View>}
      <Text style={[chip.label, selected && chip.label_selected]}>{label}</Text>
    </TouchableOpacity>
  )
}

const chip = StyleSheet.create({
  base: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.gray100,
    borderWidth: 1, borderColor: Colors.border,
  },
  selected:       { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  label:          { fontSize: FontSize.sm, color: Colors.gray700, fontWeight: FontWeight.medium },
  label_selected: { color: Colors.primary, fontWeight: FontWeight.bold },
})

// ─────────────────────────────────────────────────────────────────────────────
// STAR RATING
// ─────────────────────────────────────────────────────────────────────────────

interface StarRatingProps {
  rating:   number
  count?:   number
  size?:    'sm' | 'md'
  style?:   ViewStyle
}

export function StarRating({ rating, count, size = 'md', style }: StarRatingProps) {
  const starSize = size === 'sm' ? 12 : 14
  const stars = [1, 2, 3, 4, 5].map(i => i <= Math.round(rating))

  return (
    <View style={[star.row, style]}>
      {stars.map((filled, i) => (
        <Text key={i} style={{ fontSize: starSize, color: filled ? Colors.amber : Colors.gray200 }}>
          ★
        </Text>
      ))}
      {count !== undefined && (
        <Text style={star.count}>({count})</Text>
      )}
    </View>
  )
}

const star = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs },
  count: { fontSize: FontSize.sm, color: Colors.gray500, marginStart: Spacing.xs },
})

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  emoji?:    string
  title:     string
  subtitle?: string
  action?:   { label: string; onPress: () => void }
  style?:    ViewStyle
}

export function EmptyState({ emoji = '📭', title, subtitle, action, style }: EmptyStateProps) {
  return (
    <View style={[empty.container, style]}>
      <Text style={empty.emoji}>{emoji}</Text>
      <Text style={empty.title}>{title}</Text>
      {subtitle && <Text style={empty.subtitle}>{subtitle}</Text>}
      {action && (
        <TouchableOpacity style={empty.action_btn} onPress={action.onPress} activeOpacity={0.8}>
          <Text style={empty.action_text}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const empty = StyleSheet.create({
  container:   { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md },
  emoji:       { fontSize: 56 },
  title:       { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black, textAlign: 'center' },
  subtitle:    { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center', lineHeight: 22 },
  action_btn:  {
    marginTop: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  action_text: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
})

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER CTA  (fixed bottom button bar with safe area)
// ─────────────────────────────────────────────────────────────────────────────

interface FooterCTAProps {
  children?: React.ReactNode
  style?:    ViewStyle
}

export function FooterCTA({ children, style }: FooterCTAProps) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[
      footer.container,
      { paddingBottom: Math.max(Spacing.lg, insets.bottom + Spacing.sm) },
      style,
    ]}>
      {children}
    </View>
  )
}

const footer = StyleSheet.create({
  container: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT CONTROL  (sub-tab switcher)
// ─────────────────────────────────────────────────────────────────────────────

interface SegmentTab {
  key:   string
  label: string
}

interface SegmentControlProps {
  tabs:      SegmentTab[]
  activeKey: string
  onChange:  (key: string) => void
  style?:    ViewStyle
}

export function SegmentControl({ tabs, activeKey, onChange, style }: SegmentControlProps) {
  return (
    <View style={[seg.bar, style]}>
      {tabs.map(tab => {
        const isActive = tab.key === activeKey
        return (
          <TouchableOpacity
            key={tab.key}
            style={[seg.tab, isActive && seg.tab_active]}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.75}
          >
            <Text style={[seg.label, isActive && seg.label_active]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const seg = StyleSheet.create({
  bar:         { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab:         { flex: 1, paddingVertical: Spacing.md, alignItems: 'center' },
  tab_active:  { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  label:       { fontSize: FontSize.md, color: Colors.gray500, fontWeight: FontWeight.medium },
  label_active:{ color: Colors.primary, fontWeight: FontWeight.bold },
})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER  (title + optional "see all" link)
// ─────────────────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title:     string
  seeAll?:   string      // label for the right-side link
  onSeeAll?: () => void
  style?:    ViewStyle
}

export function SectionHeader({ title, seeAll, onSeeAll, style }: SectionHeaderProps) {
  return (
    <View style={[sec.row, style]}>
      <Text style={sec.title}>{title}</Text>
      {seeAll && onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
          <Text style={sec.link}>{seeAll}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const sec = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },
  link:  { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
})

// ─────────────────────────────────────────────────────────────────────────────
// INFO ROW  (label | value two-column row — used inside cards)
// ─────────────────────────────────────────────────────────────────────────────

interface InfoRowProps {
  label:      string
  value:      string | React.ReactNode
  style?:     ViewStyle
  valueStyle?: TextStyle
}

export function InfoRow({ label, value, style, valueStyle }: InfoRowProps) {
  return (
    <View style={[info.row, style]}>
      <Text style={info.label}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={[info.value, valueStyle]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  )
}

const info = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xxs },
  label: { fontSize: FontSize.sm, color: Colors.gray500, flex: 1 },
  value: { fontSize: FontSize.sm, color: Colors.gray900, fontWeight: FontWeight.medium, textAlign: 'right' },
})
