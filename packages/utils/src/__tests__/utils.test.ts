import {
  distanceKm,
  formatPrice,
  calcCommission,
  calcNetAmount,
  isValidTransition,
  getOrderStatusLabel,
  isValidPhone,
  isValidEmail,
  sanitizeText,
} from '../index'

describe('distanceKm', () => {
  it('returns ~0 for same point', () => {
    expect(distanceKm({ latitude: 24.7, longitude: 46.7 }, { latitude: 24.7, longitude: 46.7 }))
      .toBeCloseTo(0, 1)
  })
  it('calculates Riyadh → Jeddah ≈ 870km', () => {
    const d = distanceKm(
      { latitude: 24.7136, longitude: 46.6753 },
      { latitude: 21.3891, longitude: 39.8579 },
    )
    expect(d).toBeGreaterThan(750)
    expect(d).toBeLessThan(950)
  })
})

describe('formatPrice', () => {
  it('formats SAR in Arabic', () => {
    expect(formatPrice(150, 'SAR', 'ar')).toContain('ر.س')
  })
  it('formats SAR in English', () => {
    expect(formatPrice(150, 'SAR', 'en')).toContain('ر.س')
  })
})

describe('commission', () => {
  it('calculates 12% commission correctly', () => {
    expect(calcCommission(100, 0.12)).toBe(12)
    expect(calcNetAmount(100, 0.12)).toBe(88)
  })
  it('handles fractional amounts', () => {
    expect(calcCommission(99.99, 0.1)).toBe(10)
  })
})

describe('order state machine', () => {
  it('allows pending → quoted', () => {
    expect(isValidTransition('pending', 'quoted')).toBe(true)
  })
  it('disallows closed → confirmed', () => {
    expect(isValidTransition('closed', 'confirmed')).toBe(false)
  })
  it('allows completed → disputed', () => {
    expect(isValidTransition('completed', 'disputed')).toBe(true)
  })
})

describe('getOrderStatusLabel', () => {
  it('returns Arabic label', () => {
    expect(getOrderStatusLabel('pending', 'ar')).toBe('بانتظار العروض')
  })
  it('returns English label', () => {
    expect(getOrderStatusLabel('closed', 'en')).toBe('Closed')
  })
})

describe('validation', () => {
  it('validates Saudi phone numbers', () => {
    expect(isValidPhone('+966501234567')).toBe(true)
    expect(isValidPhone('0501234567')).toBe(true)
    expect(isValidPhone('123')).toBe(false)
  })
  it('validates emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('notanemail')).toBe(false)
  })
  it('sanitizes HTML tags', () => {
    expect(sanitizeText('<script>alert(1)</script>')).not.toContain('<')
  })
  it('truncates to maxLength', () => {
    expect(sanitizeText('hello world', 5)).toBe('hello')
  })
})
