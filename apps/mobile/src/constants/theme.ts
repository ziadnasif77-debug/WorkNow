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
  warning:        '#D97706',
  warningLight:   '#FEF3C7',
  error:          '#DC2626',
  errorLight:     '#FEE2E2',

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
