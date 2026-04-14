// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — colors, spacing, typography, shadows
// All screens import from here — never hardcode values in components
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native'

export const Colors = {
  // Brand
  primary:        '#1B4FD8',   // WorkFix blue
  primaryLight:   '#EEF2FF',
  primaryDark:    '#1338A8',

  // Semantic
  success:        '#16A34A',
  successLight:   '#DCFCE7',
  successDark:    '#065F46',   // dark green — confirmed/completed text
  info:           '#3B82F6',
  infoLight:      '#DBEAFE',   // blue-100 — quoted status bg
  infoDark:       '#1E40AF',   // blue-800 — quoted status text
  warning:        '#D97706',
  warningLight:   '#FEF3C7',
  warningDark:    '#92400E',   // dark amber — warning text on light bg
  error:          '#DC2626',
  errorLight:     '#FEE2E2',
  errorDark:      '#7F1D1D',   // deep red — critical danger backgrounds
  errorBold:      '#991B1B',   // red-800 — cancelled/disputed text

  // Extended palette
  amber:          '#F59E0B',   // star ratings
  purple:         '#7C3AED',   // freelance jobs, subscription pro tier
  purpleLight:    '#EDE9FE',   // violet-100 — in_progress status bg
  purpleDark:     '#4C1D95',   // violet-900 — in_progress status text
  orangeLight:    '#FFF7ED',   // warm orange background (onboarding slide 3)

  // Neutrals
  black:          '#0F172A',
  gray900:        '#1E293B',
  gray700:        '#334155',
  gray600:        '#475569',
  gray500:        '#64748B',
  gray400:        '#94A3B8',
  gray300:        '#CBD5E1',
  gray200:        '#E2E8F0',
  gray100:        '#F1F5F9',
  gray50:         '#F8FAFC',
  white:          '#FFFFFF',

  // Background
  background:     '#F8FAFC',
  surface:        '#FFFFFF',
  border:         '#E2E8F0',
} as const

export const Spacing = {
  xxs:  2,
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
} as const

export const Radius = {
  sm:   6,
  md:   10,
  lg:   16,
  xl:   24,
  full: 9999,
} as const

export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  xxxl: 30,
} as const

// Icon / emoji sizes — use these instead of hardcoding fontSize for icons
export const IconSize = {
  xs:    12,
  sm:    16,
  md:    20,
  lg:    24,
  xl:    32,
  xxl:   48,
  xxxl:  64,
  hero:  80,
} as const

// Avatar dimensions (diameter) — borderRadius should always be Radius.full
export const AvatarSize = {
  xs:  28,
  sm:  36,
  md:  44,
  lg:  56,
  xl:  80,
  xxl: 96,
} as const

export const FontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  bold:    '700' as const,
}

export const Shadow = {
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
    android: { elevation: 2 },
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
    android: { elevation: 4 },
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24 },
    android: { elevation: 8 },
  }),
} as const
