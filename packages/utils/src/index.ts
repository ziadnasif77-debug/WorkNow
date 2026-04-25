// ─────────────────────────────────────────────────────────────────────────────
// @workfix/utils — Shared utility functions
// ─────────────────────────────────────────────────────────────────────────────

import ngeohash from 'ngeohash'
import type { GeoPoint, OrderStatus, Currency, SupportedLocale } from '@workfix/types'

// ─────────────────────────────────────────────────────────────────────────────
// GEO UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** Encode a GeoPoint to a geohash string (precision 6 ≈ 1.2km accuracy) */
export function encodeGeohash(point: GeoPoint, precision = 6): string {
  return ngeohash.encode(point.latitude, point.longitude, precision)
}

/** Get neighbor geohashes for a given hash (used in geo queries) */
export function getGeohashRange(geohash: string): { lower: string; upper: string } {
  const neighbors = ngeohash.neighbors(geohash)
  const allHashes = [geohash, ...Object.values(neighbors)].sort()
  return {
    lower: allHashes[0] ?? geohash,
    upper: allHashes[allHashes.length - 1] ?? geohash,
  }
}

/** Calculate distance between two GeoPoints in kilometers (Haversine formula) */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const chord =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

// ─────────────────────────────────────────────────────────────────────────────
// CURRENCY & PRICE FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  // MENA
  SAR: 'ر.س',
  AED: 'د.إ',
  KWD: 'د.ك',
  BHD: 'د.ب',
  OMR: 'ر.ع',
  QAR: 'ر.ق',
  EGP: 'ج.م',
  // Scandinavia
  NOK: 'kr',
  SEK: 'kr',
}

/** Format a price for display — handles RTL (Arabic) and LTR (NO/SV/EN) */
export function formatPrice(
  amount: number,
  currency: Currency = 'SAR',
  lang: SupportedLocale = 'ar',
): string {
  const symbol = CURRENCY_SYMBOLS[currency]

  const localeMap: Record<SupportedLocale, string> = {
    ar: 'ar-SA',
    en: 'en-US',
    no: 'nb-NO',
    sv: 'sv-SE',
  }
  const formatted = amount.toLocaleString(localeMap[lang], {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  // Scandinavian convention: "150 kr"  (symbol after)
  // Arabic convention:       "150 ر.س" (symbol after, RTL handles direction)
  // English convention:      "ر.س 150" (symbol before, kept for en)
  return lang === 'en'
    ? `${symbol} ${formatted}`
    : `${formatted} ${symbol}`
}

/** Calculate commission amount from gross price */
export function calcCommission(grossAmount: number, commissionRate: number): number {
  return Math.round(grossAmount * commissionRate * 100) / 100
}

/** Calculate net amount for provider after commission */
export function calcNetAmount(grossAmount: number, commissionRate: number): number {
  return Math.round((grossAmount - calcCommission(grossAmount, commissionRate)) * 100) / 100
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

/** Format a Timestamp or Date for display */
export function formatDate(
  date: Date | { toDate(): Date },
  lang: SupportedLocale = 'ar',
  style: 'date' | 'datetime' | 'time' | 'relative' = 'datetime',
): string {
  const d = date instanceof Date ? date : date.toDate()
  const localeMap: Record<SupportedLocale, string> = {
    ar: 'ar-SA',
    en: 'en-US',
    no: 'nb-NO',
    sv: 'sv-SE',
  }
  const locale = localeMap[lang]

  if (style === 'relative') return formatRelative(d, locale)

  const options: Intl.DateTimeFormatOptions =
    style === 'time'
      ? { hour: '2-digit', minute: '2-digit' }
      : style === 'date'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }

  return new Intl.DateTimeFormat(locale, options).format(d)
}

function formatRelative(date: Date, locale: string): string {
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (diffMins < 1) return rtf.format(0, 'seconds')
  if (diffMins < 60) return rtf.format(-diffMins, 'minutes')
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return rtf.format(-diffHours, 'hours')
  return rtf.format(-Math.floor(diffHours / 24), 'days')
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valid order status transitions.
 * Key = current status, Value = allowed next statuses
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:         ['quoted', 'cancelled'],
  quoted:          ['confirmed', 'cancelled'],
  confirmed:       ['payment_pending', 'cancelled'],
  payment_pending: ['in_progress', 'cancelled'],
  in_progress:     ['completed', 'disputed'],
  completed:       ['closed', 'disputed'],
  closed:          [],
  cancelled:       [],
  disputed:        ['closed', 'cancelled'],
}

/** Check if a status transition is valid */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false
}

/** Get human-readable order status label */
export function getOrderStatusLabel(
  status: OrderStatus,
  lang: 'ar' | 'en' = 'ar',
): string {
  const labels: Record<OrderStatus, { ar: string; en: string }> = {
    pending:         { ar: 'بانتظار العروض', en: 'Pending' },
    quoted:          { ar: 'تلقّى عرض سعر', en: 'Quoted' },
    confirmed:       { ar: 'تم قبول العرض', en: 'Offer Accepted' },
    payment_pending: { ar: 'بانتظار الدفع', en: 'Payment Pending' },
    in_progress:     { ar: 'جارٍ التنفيذ', en: 'In Progress' },
    completed:       { ar: 'منتهٍ', en: 'Completed' },
    closed:          { ar: 'مغلق', en: 'Closed' },
    cancelled:       { ar: 'ملغى', en: 'Cancelled' },
    disputed:        { ar: 'نزاع مفتوح', en: 'Disputed' },
  }
  return labels[status][lang]
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function isValidPhone(phone: string): boolean {
  // Supports: +966xxxxxxxxx, 05xxxxxxxx, international formats
  return /^\+?[0-9]{9,15}$/.test(phone.replace(/[\s\-()]/g, ''))
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5
}

/** Sanitize user-supplied text (basic XSS prevention) */
export function sanitizeText(input: string, maxLength = 1000): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// ID GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a Firestore-style push ID (client-side, time-ordered) */
export function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const timestamp = Date.now().toString(36)
  let random = ''
  for (let i = 0; i < 12; i++) {
    random += chars[Math.floor(Math.random() * chars.length)]
  }
  return timestamp + random
}

// ─────────────────────────────────────────────────────────────────────────────
// String / general utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Truncate a string to maxLength, appending ellipsis if needed.
 */
export function truncate(str: string, maxLength: number, ellipsis = '…'): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - ellipsis.length) + ellipsis
}

/**
 * Convert a string to a URL-safe slug.
 * e.g. "Hello World!" → "hello-world"
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Deep equality check for plain objects/arrays.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  const keysA = Object.keys(a as object)
  const keysB = Object.keys(b as object)
  if (keysA.length !== keysB.length) return false
  return keysA.every(k =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  )
}

/**
 * Format a date relative to now (e.g. "منذ 3 دقائق", "2 minutes ago").
 */
export function formatRelativeTime(date: Date, locale: 'ar' | 'en' = 'ar'): string {
  const diff  = Date.now() - date.getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)

  if (locale === 'ar') {
    if (mins  < 1)   return 'الآن'
    if (mins  < 60)  return `منذ ${mins} دقيقة`
    if (hours < 24)  return `منذ ${hours} ساعة`
    if (days  < 7)   return `منذ ${days} يوم`
    return date.toLocaleDateString('ar-SA')
  } else {
    if (mins  < 1)   return 'just now'
    if (mins  < 60)  return `${mins}m ago`
    if (hours < 24)  return `${hours}h ago`
    if (days  < 7)   return `${days}d ago`
    return date.toLocaleDateString('en-US')
  }
}
