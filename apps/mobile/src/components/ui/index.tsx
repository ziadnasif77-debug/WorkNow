// ─────────────────────────────────────────────────────────────────────────────
// UI Components — shared across all screens
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, type ViewStyle, type TextStyle, type TextInputProps,
} from 'react-native'
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow, IconSize } from '../../constants/theme'

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON
// ─────────────────────────────────────────────────────────────────────────────

interface ButtonProps {
  label:              string
  onPress:            () => void
  variant?:           'primary' | 'outline' | 'ghost' | 'danger'
  size?:              'sm' | 'md' | 'lg'
  isLoading?:         boolean
  disabled?:          boolean
  style?:             ViewStyle
  icon?:              React.ReactNode
  fullWidth?:         boolean
  accessibilityLabel?: string
  accessibilityHint?:  string
}

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  isLoading, disabled, style, icon, fullWidth = true,
  accessibilityLabel, accessibilityHint,
}: ButtonProps) {
  const isDisabled = disabled || isLoading

  const containerStyle: ViewStyle[] = [
    styles.btn,
    styles[`btn_${variant}`],
    styles[`btn_${size}`],
    ...(fullWidth ? [styles.btn_full] : []),
    ...(isDisabled ? [styles.btn_disabled] : []),
    style ?? {},
  ]

  const labelStyle: TextStyle[] = [
    styles.btn_label,
    styles[`btn_label_${variant}`],
    styles[`btn_label_${size}`],
  ]

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'primary' ? Colors.white : Colors.primary}
          size="small"
        />
      ) : (
        <View style={styles.btn_inner}>
          {icon && <View style={styles.btn_icon}>{icon}</View>}
          <Text style={labelStyle}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT INPUT
// ─────────────────────────────────────────────────────────────────────────────

interface InputProps extends TextInputProps {
  label?:       string
  error?:       string
  hint?:        string
  leftIcon?:    React.ReactNode
  rightIcon?:   React.ReactNode
  containerStyle?: ViewStyle
}

export function Input({
  label, error, hint, leftIcon, rightIcon,
  containerStyle, style, ...props
}: InputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <View style={[styles.input_container, containerStyle]}>
      {label && <Text style={styles.input_label}>{label}</Text>}
      <View style={[
        styles.input_wrap,
        focused && styles.input_wrap_focused,
        !!error && styles.input_wrap_error,
      ]}>
        {leftIcon && <View style={styles.input_icon_left}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            ...(leftIcon  ? [styles.input_with_left]  : []),
            ...(rightIcon ? [styles.input_with_right] : []),
            style ?? {},
          ]}
          placeholderTextColor={Colors.gray400}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {rightIcon && <View style={styles.input_icon_right}>{rightIcon}</View>}
      </View>
      {error  && <Text style={styles.input_error}>{error}</Text>}
      {!error && hint && <Text style={styles.input_hint}>{hint}</Text>}
    </View>
  )
}

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
  const cardStyle = [styles.card, { padding }, style ?? {}]

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.9}>
        {children}
      </TouchableOpacity>
    )
  }
  return <View style={cardStyle}>{children}</View>
}

// ─────────────────────────────────────────────────────────────────────────────
// DIVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function Divider({ label, style }: { label?: string; style?: ViewStyle }) {
  if (!label) return <View style={[styles.divider, style]} />

  return (
    <View style={[styles.divider_labeled, style]}>
      <View style={styles.divider_line} />
      <Text style={styles.divider_text}>{label}</Text>
      <View style={styles.divider_line} />
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN WRAPPER (safe area + background)
// ─────────────────────────────────────────────────────────────────────────────

import { SafeAreaView, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'

interface ScreenProps {
  children:    React.ReactNode
  scroll?:     boolean
  style?:      ViewStyle
  padded?:     boolean
  avoidKeyboard?: boolean
}

export function Screen({ children, scroll, style, padded = true, avoidKeyboard }: ScreenProps) {
  const content = (
    <SafeAreaView style={[styles.screen, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={padded && styles.screen_padded}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screen_content, padded && styles.screen_padded]}>
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

// ─────────────────────────────────────────────────────────────────────────────
// OTP INPUT
// ─────────────────────────────────────────────────────────────────────────────

interface OtpInputProps {
  length?:   number
  value:     string
  onChange:  (val: string) => void
  error?:    string
}

export function OtpInput({ length = 6, value, onChange, error }: OtpInputProps) {
  const digits = value.split('').slice(0, length)
  while (digits.length < length) digits.push('')

  return (
    <View>
      <View style={styles.otp_row}>
        {digits.map((d, i) => (
          <View
            key={i}
            style={[
              styles.otp_box,
              d !== '' && styles.otp_box_filled,
              !!error && styles.otp_box_error,
            ]}
          >
            <Text style={styles.otp_digit}>{d}</Text>
          </View>
        ))}
      </View>
      {/* Hidden input captures all typing */}
      <TextInput
        style={styles.otp_hidden}
        value={value}
        onChangeText={t => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
      />
      {error && <Text style={styles.input_error}>{error}</Text>}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Button
  btn: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn_inner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  btn_icon:  { width: IconSize.md, height: IconSize.md, alignItems: 'center', justifyContent: 'center' },
  btn_full:  { width: '100%' },

  btn_primary:  { backgroundColor: Colors.primary, ...Shadow.sm },
  btn_outline:  { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  btn_ghost:    { backgroundColor: 'transparent' },
  btn_danger:   { backgroundColor: Colors.error },
  btn_disabled: { opacity: 0.5 },

  btn_sm: { height: 36, paddingHorizontal: Spacing.md },
  btn_md: { height: 50, paddingHorizontal: Spacing.lg },
  btn_lg: { height: 56, paddingHorizontal: Spacing.xl },

  btn_label:          { fontWeight: FontWeight.bold, letterSpacing: 0.2 },
  btn_label_primary:  { color: Colors.white,   fontSize: FontSize.md },
  btn_label_outline:  { color: Colors.primary, fontSize: FontSize.md },
  btn_label_ghost:    { color: Colors.primary, fontSize: FontSize.md },
  btn_label_danger:   { color: Colors.white,   fontSize: FontSize.md },
  btn_label_sm:       { fontSize: FontSize.sm },
  btn_label_md:       { fontSize: FontSize.md },
  btn_label_lg:       { fontSize: FontSize.lg },

  // Input
  input_container: { gap: Spacing.xs, marginBottom: Spacing.md },
  input_label:     { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.gray700 },
  input_wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
  },
  input_wrap_focused: { borderColor: Colors.primary },
  input_wrap_error:   { borderColor: Colors.error },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.black,
  },
  input_with_left:  { paddingStart: 0 },
  input_with_right: { paddingEnd: 0 },
  input_icon_left:  { paddingStart: Spacing.md, paddingEnd: Spacing.sm },
  input_icon_right: { paddingEnd: Spacing.md, paddingStart: Spacing.sm },
  input_error: { fontSize: FontSize.xs, color: Colors.error, marginTop: Spacing.xxs },
  input_hint:  { fontSize: FontSize.xs, color: Colors.gray500, marginTop: Spacing.xxs },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },

  // Divider
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  divider_labeled: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.md },
  divider_line:    { flex: 1, height: 1, backgroundColor: Colors.border },
  divider_text:    { fontSize: FontSize.sm, color: Colors.gray400, fontWeight: FontWeight.medium },

  // Screen
  screen:         { flex: 1, backgroundColor: Colors.background },
  screen_content: { flex: 1 },
  screen_padded:  { paddingHorizontal: Spacing.lg },

  // OTP
  otp_row:        { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  otp_box: {
    width: 48, height: 56, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  otp_box_filled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  otp_box_error:  { borderColor: Colors.error },
  otp_digit:      { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  otp_hidden:     { position: 'absolute', opacity: 0, width: 1, height: 1 },
})
