// ─────────────────────────────────────────────────────────────────────────────
// @workfix/utils — extended unit tests for uncovered functions
// Covers: encodeGeohash, getGeohashRange, formatDate, formatRelativeTime,
//         generateId, truncate, slugify, deepEqual, isValidRating,
//         formatPrice (all currencies), calcCommission edge cases
// ─────────────────────────────────────────────────────────────────────────────

import {
  encodeGeohash,
  getGeohashRange,
  formatDate,
  formatRelativeTime,
  generateId,
  truncate,
  slugify,
  deepEqual,
  isValidRating,
  formatPrice,
  calcCommission,
  calcNetAmount,
  isValidTransition,
} from '../index'

// ─────────────────────────────────────────────────────────────────────────────
// encodeGeohash
// ─────────────────────────────────────────────────────────────────────────────

describe('encodeGeohash', () => {
  it('returns a string', () => {
    const h = encodeGeohash({ latitude: 24.7, longitude: 46.7 })
    expect(typeof h).toBe('string')
    expect(h.length).toBeGreaterThan(0)
  })

  it('default precision is 6 characters', () => {
    const h = encodeGeohash({ latitude: 24.7136, longitude: 46.6753 })
    expect(h).toHaveLength(6)
  })

  it('respects custom precision', () => {
    const h4 = encodeGeohash({ latitude: 24.7, longitude: 46.7 }, 4)
    const h8 = encodeGeohash({ latitude: 24.7, longitude: 46.7 }, 8)
    expect(h4).toHaveLength(4)
    expect(h8).toHaveLength(8)
  })

  it('same point encodes to the same hash', () => {
    const p = { latitude: 21.3891, longitude: 39.8579 }
    expect(encodeGeohash(p)).toBe(encodeGeohash(p))
  })

  it('nearby points share a common prefix', () => {
    // Riyadh city center vs 500m away — should share first 4+ chars at precision 6
    const center = encodeGeohash({ latitude: 24.7136, longitude: 46.6753 })
    const nearby  = encodeGeohash({ latitude: 24.7140, longitude: 46.6760 })
    expect(center.slice(0, 4)).toBe(nearby.slice(0, 4))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getGeohashRange
// ─────────────────────────────────────────────────────────────────────────────

describe('getGeohashRange', () => {
  it('returns lower and upper strings', () => {
    const { lower, upper } = getGeohashRange('sj2vtw')
    expect(typeof lower).toBe('string')
    expect(typeof upper).toBe('string')
  })

  it('lower is lexicographically ≤ upper', () => {
    const { lower, upper } = getGeohashRange('sj2vtw')
    expect(lower <= upper).toBe(true)
  })

  it('original hash is within [lower, upper]', () => {
    const hash = 'sj2vtw'
    const { lower, upper } = getGeohashRange(hash)
    expect(hash >= lower).toBe(true)
    expect(hash <= upper).toBe(true)
  })

  it('works for different geohashes', () => {
    // Oslo, Norway
    const { lower, upper } = getGeohashRange('u4pruyd')
    expect(lower).toBeTruthy()
    expect(upper).toBeTruthy()
    expect(lower <= upper).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// formatDate
// ─────────────────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  const testDate = new Date('2025-01-15T14:30:00Z')

  it('formats a Date object in Arabic', () => {
    const result = formatDate(testDate, 'ar', 'date')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formats a Date object in English', () => {
    const result = formatDate(testDate, 'en', 'date')
    expect(result).toMatch(/2025/)
    expect(result).toMatch(/Jan|January|15/)
  })

  it('formats a Date object in Norwegian', () => {
    const result = formatDate(testDate, 'no', 'date')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formats a Date object in Swedish', () => {
    const result = formatDate(testDate, 'sv', 'date')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formats with time style', () => {
    const result = formatDate(testDate, 'en', 'time')
    // Should contain hour:minute pattern
    expect(result).toMatch(/\d{1,2}[:.]\d{2}/)
  })

  it('formats with datetime style', () => {
    const result = formatDate(testDate, 'en', 'datetime')
    expect(result).toMatch(/2025/)
  })

  it('accepts Firestore-like object with toDate()', () => {
    const firestoreTs = { toDate: () => testDate }
    const result = formatDate(firestoreTs, 'en', 'date')
    expect(result).toMatch(/2025/)
  })

  it('returns relative format for style="relative"', () => {
    // A date 5 minutes ago
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000)
    const result = formatDate(fiveMinAgo, 'en', 'relative')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// formatRelativeTime
// ─────────────────────────────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  it('returns "الآن" for current time (Arabic)', () => {
    const now = new Date()
    expect(formatRelativeTime(now, 'ar')).toBe('الآن')
  })

  it('returns "just now" for current time (English)', () => {
    const now = new Date()
    expect(formatRelativeTime(now, 'en')).toBe('just now')
  })

  it('returns minutes ago in Arabic', () => {
    const threeMinAgo = new Date(Date.now() - 3 * 60_000)
    const result = formatRelativeTime(threeMinAgo, 'ar')
    expect(result).toContain('دقيقة')
    expect(result).toContain('3')
  })

  it('returns minutes ago in English', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60_000)
    const result = formatRelativeTime(tenMinAgo, 'en')
    expect(result).toMatch(/10m ago/)
  })

  it('returns hours ago in Arabic', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000)
    const result = formatRelativeTime(twoHoursAgo, 'ar')
    expect(result).toContain('ساعة')
  })

  it('returns hours ago in English', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000)
    const result = formatRelativeTime(twoHoursAgo, 'en')
    expect(result).toMatch(/2h ago/)
  })

  it('returns days ago in Arabic', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000)
    const result = formatRelativeTime(threeDaysAgo, 'ar')
    expect(result).toContain('يوم')
  })

  it('returns days ago in English', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000)
    const result = formatRelativeTime(twoDaysAgo, 'en')
    expect(result).toMatch(/2d ago/)
  })

  it('returns formatted date for 8+ days (Arabic)', () => {
    const oldDate = new Date(Date.now() - 10 * 86_400_000)
    const result = formatRelativeTime(oldDate, 'ar')
    // Should not contain 'يوم' and not be 'الآن'
    expect(result).not.toBe('الآن')
    expect(result.length).toBeGreaterThan(0)
  })

  it('defaults to Arabic locale', () => {
    const now = new Date()
    expect(formatRelativeTime(now)).toBe('الآن')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// generateId
// ─────────────────────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(generateId().length).toBeGreaterThan(0)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })

  it('IDs are time-ordered (lexicographic)', () => {
    const id1 = generateId()
    const id2 = generateId()
    // Both generated in the same millisecond window but first should be ≤ second
    // (timestamps are encoded as base36 prefix)
    expect(id1.slice(0, 8) <= id2.slice(0, 8)).toBe(true)
  })

  it('ID contains only alphanumeric characters', () => {
    const id = generateId()
    expect(id).toMatch(/^[A-Za-z0-9]+$/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// truncate
// ─────────────────────────────────────────────────────────────────────────────

describe('truncate', () => {
  it('returns original string when shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('returns original string when equal to maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })

  it('truncates and appends default ellipsis (…)', () => {
    expect(truncate('hello world', 8)).toBe('hello w…')
  })

  it('uses custom ellipsis', () => {
    expect(truncate('hello world', 8, '...')).toBe('hello...')
  })

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('')
  })

  it('handles Arabic text', () => {
    const arabic = 'مرحبا بالعالم العربي الجميل'
    const result = truncate(arabic, 10)
    expect(result.length).toBeLessThanOrEqual(10)
  })

  it('truncates to exactly maxLength characters including ellipsis', () => {
    const result = truncate('abcdefghij', 7)
    expect(result).toHaveLength(7)
    expect(result).toBe('abcdef…')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// slugify
// ─────────────────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
  })

  it('collapses multiple spaces/hyphens', () => {
    expect(slugify('hello   world')).toBe('hello-world')
    expect(slugify('hello--world')).toBe('hello-world')
  })

  it('removes leading/trailing hyphens', () => {
    expect(slugify('  hello world  ')).toBe('hello-world')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('handles service names', () => {
    expect(slugify('AC Installation & Repair')).toBe('ac-installation-repair')
  })

  it('preserves numbers', () => {
    expect(slugify('Service 24/7')).toBe('service-247')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deepEqual
// ─────────────────────────────────────────────────────────────────────────────

describe('deepEqual', () => {
  it('returns true for identical primitives', () => {
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual('hello', 'hello')).toBe(true)
    expect(deepEqual(true, true)).toBe(true)
    expect(deepEqual(null, null)).toBe(true)
  })

  it('returns false for different primitives', () => {
    expect(deepEqual(1, 2)).toBe(false)
    expect(deepEqual('a', 'b')).toBe(false)
  })

  it('returns true for deeply equal objects', () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true)
  })

  it('returns false for objects with different values', () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('returns false for objects with different keys', () => {
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false)
  })

  it('returns true for nested arrays', () => {
    expect(deepEqual([1, 2, [3, 4]], [1, 2, [3, 4]])).toBe(true)
  })

  it('returns false for arrays with different lengths', () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
  })

  it('returns false for null vs object', () => {
    expect(deepEqual(null, {})).toBe(false)
    expect(deepEqual({}, null)).toBe(false)
  })

  it('handles GeoPoint-like objects', () => {
    const p1 = { latitude: 24.7, longitude: 46.7 }
    const p2 = { latitude: 24.7, longitude: 46.7 }
    const p3 = { latitude: 24.7, longitude: 46.8 }
    expect(deepEqual(p1, p2)).toBe(true)
    expect(deepEqual(p1, p3)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isValidRating
// ─────────────────────────────────────────────────────────────────────────────

describe('isValidRating', () => {
  it('accepts valid ratings 1–5', () => {
    for (const r of [1, 2, 3, 4, 5]) {
      expect(isValidRating(r)).toBe(true)
    }
  })

  it('rejects 0', () => {
    expect(isValidRating(0)).toBe(false)
  })

  it('rejects 6', () => {
    expect(isValidRating(6)).toBe(false)
  })

  it('rejects negative values', () => {
    expect(isValidRating(-1)).toBe(false)
  })

  it('rejects float values', () => {
    expect(isValidRating(3.5)).toBe(false)
    expect(isValidRating(4.9)).toBe(false)
  })

  it('rejects NaN', () => {
    expect(isValidRating(NaN)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// formatPrice — all currencies
// ─────────────────────────────────────────────────────────────────────────────

describe('formatPrice — currency coverage', () => {
  it('formats AED in Arabic', () => {
    expect(formatPrice(100, 'AED', 'ar')).toContain('د.إ')
  })

  it('formats KWD in Arabic', () => {
    expect(formatPrice(10, 'KWD', 'ar')).toContain('د.ك')
  })

  it('formats BHD in Arabic', () => {
    expect(formatPrice(10, 'BHD', 'ar')).toContain('د.ب')
  })

  it('formats OMR in Arabic', () => {
    expect(formatPrice(10, 'OMR', 'ar')).toContain('ر.ع')
  })

  it('formats QAR in Arabic', () => {
    expect(formatPrice(10, 'QAR', 'ar')).toContain('ر.ق')
  })

  it('formats EGP in Arabic', () => {
    expect(formatPrice(100, 'EGP', 'ar')).toContain('ج.م')
  })

  it('formats NOK in Norwegian — symbol after amount', () => {
    const result = formatPrice(150, 'NOK', 'no')
    expect(result).toContain('kr')
    expect(result.trim().endsWith('kr')).toBe(true)
  })

  it('formats SEK in Swedish — symbol after amount', () => {
    const result = formatPrice(999, 'SEK', 'sv')
    expect(result).toContain('kr')
  })

  it('formats NOK in English — symbol before amount', () => {
    const result = formatPrice(150, 'NOK', 'en')
    expect(result).toMatch(/^kr\s/)
  })

  it('formats 0 amount correctly', () => {
    const result = formatPrice(0, 'SAR', 'en')
    expect(result).toContain('ر.س')
    expect(result).toContain('0')
  })

  it('formats fractional amounts', () => {
    const result = formatPrice(99.99, 'SAR', 'en')
    expect(result).toContain('99')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// calcCommission — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('calcCommission — edge cases', () => {
  it('returns 0 for 0 amount', () => {
    expect(calcCommission(0, 0.12)).toBe(0)
    expect(calcNetAmount(0, 0.12)).toBe(0)
  })

  it('gross = commission + net always', () => {
    const cases = [
      [100, 0.12], [350, 0.12], [99.99, 0.12],
      [1000, 0.10], [77.77, 0.15],
    ] as [number, number][]
    cases.forEach(([gross, rate]) => {
      const comm = calcCommission(gross, rate)
      const net  = calcNetAmount(gross, rate)
      expect(comm + net).toBeCloseTo(gross, 1)
    })
  })

  it('0% commission returns full amount as net', () => {
    expect(calcCommission(200, 0)).toBe(0)
    expect(calcNetAmount(200, 0)).toBe(200)
  })

  it('100% commission returns 0 net', () => {
    expect(calcCommission(100, 1)).toBe(100)
    expect(calcNetAmount(100, 1)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ORDER_TRANSITIONS — remaining paths
// ─────────────────────────────────────────────────────────────────────────────

describe('order state machine — additional paths', () => {
  it('pending → cancelled is valid', () => {
    expect(isValidTransition('pending', 'cancelled')).toBe(true)
  })

  it('quoted → cancelled is valid', () => {
    expect(isValidTransition('quoted', 'cancelled')).toBe(true)
  })

  it('confirmed → cancelled is valid', () => {
    expect(isValidTransition('confirmed', 'cancelled')).toBe(true)
  })

  it('confirmed → disputed is valid', () => {
    expect(isValidTransition('confirmed', 'disputed')).toBe(true)
  })

  it('in_progress → disputed is valid', () => {
    expect(isValidTransition('in_progress', 'disputed')).toBe(true)
  })

  it('disputed → closed is valid', () => {
    expect(isValidTransition('disputed', 'closed')).toBe(true)
  })

  it('disputed → cancelled is valid', () => {
    expect(isValidTransition('disputed', 'cancelled')).toBe(true)
  })

  it('cancelled → anything is invalid', () => {
    const statuses = ['pending','quoted','confirmed','in_progress','completed','closed','disputed','cancelled'] as const
    statuses.forEach(s => expect(isValidTransition('cancelled', s)).toBe(false))
  })

  it('completed → closed is valid', () => {
    expect(isValidTransition('completed', 'closed')).toBe(true)
  })

  it('in_progress → completed is valid', () => {
    expect(isValidTransition('in_progress', 'completed')).toBe(true)
  })
})
