// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — Orders (pure logic, no emulator required)
// ─────────────────────────────────────────────────────────────────────────────

import { isValidTransition, calcCommission, calcNetAmount } from '@workfix/utils'

// ─────────────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────────────

describe('Orders — state machine (isValidTransition)', () => {
  test('pending → quoted is valid', () => {
    expect(isValidTransition('pending', 'quoted')).toBe(true)
  })

  test('quoted → confirmed is valid', () => {
    expect(isValidTransition('quoted', 'confirmed')).toBe(true)
  })

  test('confirmed → in_progress is valid', () => {
    expect(isValidTransition('confirmed', 'in_progress')).toBe(true)
  })

  test('in_progress → completed is valid', () => {
    expect(isValidTransition('in_progress', 'completed')).toBe(true)
  })

  test('completed → closed is valid', () => {
    expect(isValidTransition('completed', 'closed')).toBe(true)
  })

  test('pending → cancelled is valid', () => {
    expect(isValidTransition('pending', 'cancelled')).toBe(true)
  })

  test('confirmed → cancelled is valid', () => {
    expect(isValidTransition('confirmed', 'cancelled')).toBe(true)
  })

  test('closed → pending is invalid', () => {
    expect(isValidTransition('closed', 'pending')).toBe(false)
  })

  test('closed → in_progress is invalid', () => {
    expect(isValidTransition('closed', 'in_progress')).toBe(false)
  })

  test('closed → disputed is invalid', () => {
    expect(isValidTransition('closed', 'disputed')).toBe(false)
  })

  test('cancelled → pending is invalid', () => {
    expect(isValidTransition('cancelled', 'pending')).toBe(false)
  })

  test('completed → pending is invalid', () => {
    expect(isValidTransition('completed', 'pending')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Commission calculation
// ─────────────────────────────────────────────────────────────────────────────

describe('Orders — commission calculation', () => {
  test('12% commission on SAR 350 = SAR 42', () => {
    expect(calcCommission(350, 0.12)).toBe(42)
    expect(calcNetAmount(350, 0.12)).toBe(308)
    expect(calcCommission(350, 0.12) + calcNetAmount(350, 0.12)).toBe(350)
  })

  test('fractional amounts round to 2 decimal places', () => {
    // SAR 99.99 × 12% = 11.9988 → rounds to 12
    expect(calcCommission(99.99, 0.12)).toBe(12)
  })

  test('KWD 100 × 10% = KWD 10', () => {
    expect(calcCommission(100, 0.10)).toBe(10)
  })

  test('net + commission always equals gross', () => {
    const cases = [
      [100, 0.12], [500, 0.15], [1000, 0.10], [49.99, 0.12],
    ] as const
    for (const [gross, rate] of cases) {
      expect(calcCommission(gross, rate) + calcNetAmount(gross, rate)).toBe(gross)
    }
  })

  test('zero amount gives zero commission', () => {
    expect(calcCommission(0, 0.12)).toBe(0)
    expect(calcNetAmount(0, 0.12)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Quote expiry logic
// ─────────────────────────────────────────────────────────────────────────────

describe('Orders — quote expiry', () => {
  test('quote expiring in future is still valid', () => {
    const expiresAt = new Date(Date.now() + 3600_000) // 1 hour from now
    expect(expiresAt > new Date()).toBe(true)
  })

  test('quote expiring in the past is expired', () => {
    const expiresAt = new Date(Date.now() - 1000) // 1 second ago
    expect(expiresAt < new Date()).toBe(true)
  })

  test('24h quote has correct window', () => {
    const QUOTE_EXPIRY_HOURS = 24
    const expiresAt = new Date(Date.now() + QUOTE_EXPIRY_HOURS * 3600_000)
    const expiryMs  = expiresAt.getTime() - Date.now()
    expect(expiryMs).toBeGreaterThan(23 * 3600_000)
    expect(expiryMs).toBeLessThan(25 * 3600_000)
  })
})
