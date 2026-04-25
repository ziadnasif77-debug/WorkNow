// ─────────────────────────────────────────────────────────────────────────────
// Order UI components — StatusBadge, StatusTimeline, QuoteCard
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors, Spacing, FontSize, FontWeight, Radius, AvatarSize, IconSize } from '../constants/theme'
import { getOrderStatusLabel, formatPrice } from '@workfix/utils'
import type { OrderStatus, Quote } from '@workfix/types'

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string }> = {
  pending:         { bg: Colors.warningLight, text: Colors.warningDark },
  quoted:          { bg: Colors.infoLight,    text: Colors.infoDark },
  confirmed:       { bg: Colors.successLight, text: Colors.successDark },
  payment_pending: { bg: Colors.orangeLight,  text: '#C2410C' },
  in_progress:     { bg: Colors.purpleLight,  text: Colors.purpleDark },
  completed:       { bg: Colors.successLight, text: Colors.successDark },
  closed:          { bg: Colors.gray100,      text: Colors.gray600 },
  cancelled:       { bg: Colors.errorLight,   text: Colors.errorBold },
  disputed:        { bg: Colors.errorLight,   text: Colors.errorBold } }

interface StatusBadgeProps {
  status: OrderStatus
  size?:  'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { i18n } = useTranslation()
  const lang     = (i18n.language ?? 'ar') as 'ar' | 'en'
  const colors   = STATUS_COLORS[status]
  const label    = getOrderStatusLabel(status, lang)

  return (
    <View style={[
      styles.badge,
      { backgroundColor: colors.bg },
      size === 'sm' && styles.badge_sm,
    ]}>
      <Text style={[
        styles.badge_text,
        { color: colors.text },
        size === 'sm' && styles.badge_text_sm,
      ]}>
        {label}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

const TIMELINE_STEPS: OrderStatus[] = [
  'pending', 'quoted', 'confirmed', 'in_progress', 'completed', 'closed',
]

const STEP_EMOJIS: Partial<Record<OrderStatus, string>> = {
  pending:     '📝',
  quoted:      '💬',
  confirmed:   '✅',
  in_progress: '🔧',
  completed:   '🏁',
  closed:      '⭐' }

interface StatusTimelineProps {
  currentStatus: OrderStatus
}

export function StatusTimeline({ currentStatus }: StatusTimelineProps) {
  const { t: _t, i18n } = useTranslation()
  const lang = (i18n.language ?? 'ar') as 'ar' | 'en'

  if (currentStatus === 'cancelled' || currentStatus === 'disputed') {
    return (
      <View style={styles.cancelled_banner}>
        <Text style={styles.cancelled_emoji}>
          {currentStatus === 'cancelled' ? '❌' : '⚠️'}
        </Text>
        <Text style={styles.cancelled_text}>
          {getOrderStatusLabel(currentStatus, lang)}
        </Text>
      </View>
    )
  }

  const currentIdx = TIMELINE_STEPS.indexOf(currentStatus)

  return (
    <View style={styles.timeline}>
      {TIMELINE_STEPS.map((step, idx) => {
        const isDone    = idx < currentIdx
        const isActive  = idx === currentIdx
        const isPending = idx > currentIdx

        return (
          <React.Fragment key={step}>
            <View style={styles.timeline_step}>
              <View style={[
                styles.timeline_dot,
                isDone   && styles.timeline_dot_done,
                isActive && styles.timeline_dot_active,
              ]}>
                <Text style={styles.timeline_dot_emoji}>
                  {isDone ? '✓' : (STEP_EMOJIS[step] ?? '○')}
                </Text>
              </View>
              <Text style={[
                styles.timeline_label,
                isActive && styles.timeline_label_active,
                isPending && styles.timeline_label_pending,
              ]}>
                {getOrderStatusLabel(step, lang)}
              </Text>
            </View>
            {idx < TIMELINE_STEPS.length - 1 && (
              <View style={[
                styles.timeline_line,
                idx < currentIdx && styles.timeline_line_done,
              ]} />
            )}
          </React.Fragment>
        )
      })}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE CARD
// ─────────────────────────────────────────────────────────────────────────────

interface QuoteCardProps {
  quote:        Quote
  isCustomer:   boolean
  onAccept?:    (quoteId: string) => void
  onReject?:    (quoteId: string) => void
  isLoading?:   boolean
}

export function QuoteCard({ quote, isCustomer, onAccept, onReject, isLoading }: QuoteCardProps) {
  const { t } = useTranslation()

  const isExpired = new Date() > (quote.expiresAt as unknown as Date)
  const isPending = quote.status === 'pending' && !isExpired

  return (
    <View style={[
      styles.quote_card,
      quote.status === 'accepted' && styles.quote_card_accepted,
    ]}>
      {/* Provider info */}
      <View style={styles.quote_header}>
        <View style={styles.quote_avatar}>
          <Text style={styles.quote_avatar_letter}>
            {(quote.providerName ?? '?')[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={styles.quote_meta}>
          <Text style={styles.quote_provider}>{quote.providerName}</Text>
          <View style={styles.quote_rating_row}>
            <Text style={styles.quote_star}>★</Text>
            <Text style={styles.quote_rating}>{quote.providerRating.toFixed(1)}</Text>
          </View>
        </View>
        <View style={styles.quote_price_section}>
          <Text style={styles.quote_price}>
            {formatPrice(quote.price, quote.currency, 'ar')}
          </Text>
          <Text style={styles.quote_duration}>
            ~{quote.estimatedDurationMinutes} {t('common.minutes')}
          </Text>
        </View>
      </View>

      {/* Note */}
      {quote.note && (
        <Text style={styles.quote_note}>{quote.note}</Text>
      )}

      {/* Status / Actions */}
      {quote.status === 'accepted' && (
        <View style={styles.quote_accepted_badge}>
          <Text style={styles.quote_accepted_text}>✓ {t('orders.quoteAccepted')}</Text>
        </View>
      )}

      {quote.status === 'rejected' && (
        <Text style={styles.quote_rejected}>{t('orders.quoteRejected')}</Text>
      )}

      {isExpired && quote.status === 'pending' && (
        <Text style={styles.quote_expired}>{t('orders.quoteExpired')}</Text>
      )}

      {isCustomer && isPending && onAccept && onReject && (
        <View style={styles.quote_actions}>
          <TouchableOpacity
            style={[styles.quote_btn, styles.quote_btn_accept]}
            onPress={() => onAccept(quote.id)}
            disabled={isLoading}
          >
            <Text style={styles.quote_btn_accept_text}>{t('orders.acceptQuote')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quote_btn, styles.quote_btn_reject]}
            onPress={() => onReject(quote.id)}
            disabled={isLoading}
          >
            <Text style={styles.quote_btn_reject_text}>{t('orders.rejectQuote')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Badge
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full },
  badge_sm: { paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badge_text:    { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  badge_text_sm: { fontSize: FontSize.xs },

  // Timeline
  timeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm },
  timeline_step:  { alignItems: 'center', gap: 6, flex: 0 },
  timeline_dot: {
    width: AvatarSize.sm, height: AvatarSize.sm, borderRadius: Radius.full,
    backgroundColor: Colors.gray100,
    borderWidth: 2, borderColor: Colors.gray200,
    alignItems: 'center', justifyContent: 'center' },
  timeline_dot_done:   { backgroundColor: Colors.successLight, borderColor: Colors.success },
  timeline_dot_active: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary, transform: [{ scale: 1.15 }] },
  timeline_dot_emoji:  { fontSize: IconSize.sm },
  timeline_label: {
    fontSize: 9, color: Colors.gray400, textAlign: 'center',
    maxWidth: 52, fontWeight: FontWeight.medium },
  timeline_label_active:  { color: Colors.primary, fontWeight: FontWeight.bold },
  timeline_label_pending: { color: Colors.gray300 },
  timeline_line: {
    flex: 1, height: 2, backgroundColor: Colors.gray200,
    marginTop: 17, marginHorizontal: 2 },
  timeline_line_done: { backgroundColor: Colors.success },
  cancelled_banner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.errorLight, borderRadius: Radius.md,
    padding: Spacing.md, marginVertical: Spacing.sm },
  cancelled_emoji: { fontSize: 24 },
  cancelled_text:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.error },

  // Quote card
  quote_card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.border,
    gap: Spacing.sm },
  quote_card_accepted: { borderColor: Colors.success, backgroundColor: Colors.successLight },
  quote_header:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  quote_avatar: {
    width: AvatarSize.md, height: AvatarSize.md, borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center' },
  quote_avatar_letter: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  quote_meta:          { flex: 1, gap: 3 },
  quote_provider:      { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  quote_rating_row:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  quote_star:          { fontSize: 13, color: Colors.amber },
  quote_rating:        { fontSize: FontSize.sm, color: Colors.gray500 },
  quote_price_section: { alignItems: 'flex-end', gap: 2 },
  quote_price:         { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  quote_duration:      { fontSize: FontSize.xs, color: Colors.gray400 },
  quote_note: {
    fontSize: FontSize.sm, color: Colors.gray600,
    backgroundColor: Colors.gray50, borderRadius: Radius.sm,
    padding: Spacing.sm, lineHeight: 20 },
  quote_accepted_badge: {
    backgroundColor: Colors.successLight, borderRadius: Radius.sm,
    padding: Spacing.sm, alignItems: 'center' },
  quote_accepted_text: { color: Colors.success, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  quote_rejected:      { color: Colors.gray400, fontSize: FontSize.sm, textAlign: 'center' },
  quote_expired:       { color: Colors.warning, fontSize: FontSize.sm, textAlign: 'center' },
  quote_actions:       { flexDirection: 'row', gap: Spacing.sm },
  quote_btn: {
    flex: 1, height: 42, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center' },
  quote_btn_accept:      { backgroundColor: Colors.primary },
  quote_btn_reject:      { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  quote_btn_accept_text: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  quote_btn_reject_text: { color: Colors.gray600, fontWeight: FontWeight.medium, fontSize: FontSize.md } })
