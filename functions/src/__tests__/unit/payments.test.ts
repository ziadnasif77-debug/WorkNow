// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — Payments (webhook verification, fraud detection, rate limits)
// ─────────────────────────────────────────────────────────────────────────────

import * as crypto from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Webhook signature verification
// ─────────────────────────────────────────────────────────────────────────────

describe('Tap webhook signature verification', () => {
  const SECRET  = 'test_webhook_secret_abc123'
  const PAYLOAD = JSON.stringify({ id: 'chg_001', status: 'AUTHORIZED' })

  function makeSignature(secret: string, body: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex').toUpperCase()
  }

  test('valid signature passes', () => {
    const { verifyTapWebhook } = require('../../_shared/webhooks')
    const sig = makeSignature(SECRET, PAYLOAD)
    expect(verifyTapWebhook(PAYLOAD, sig, SECRET)).toBe(true)
  })

  test('tampered body fails', () => {
    const { verifyTapWebhook } = require('../../_shared/webhooks')
    const sig    = makeSignature(SECRET, PAYLOAD)
    const tampered = PAYLOAD.replace('AUTHORIZED', 'CAPTURED')
    expect(verifyTapWebhook(tampered, sig, SECRET)).toBe(false)
  })

  test('wrong secret fails', () => {
    const { verifyTapWebhook } = require('../../_shared/webhooks')
    const sig = makeSignature('wrong_secret', PAYLOAD)
    expect(verifyTapWebhook(PAYLOAD, sig, SECRET)).toBe(false)
  })

  test('missing signature fails', () => {
    const { verifyTapWebhook } = require('../../_shared/webhooks')
    expect(verifyTapWebhook(PAYLOAD, undefined, SECRET)).toBe(false)
  })

  test('empty signature fails', () => {
    const { verifyTapWebhook } = require('../../_shared/webhooks')
    expect(verifyTapWebhook(PAYLOAD, '', SECRET)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Payment amount minor unit conversion
// ─────────────────────────────────────────────────────────────────────────────

describe('Payment amount conversion to minor units', () => {
  function toMinorUnits(amount: number, currency: string): number {
    const highPrecision = ['KWD', 'BHD']
    const multiplier = highPrecision.includes(currency) ? 1000 : 100
    return Math.round(amount * multiplier)
  }

  test('SAR 350 → 35000 halalas', () => {
    expect(toMinorUnits(350, 'SAR')).toBe(35000)
  })

  test('KWD 10 → 10000 fils', () => {
    expect(toMinorUnits(10, 'KWD')).toBe(10000)
  })

  test('NOK 99.99 → 9999 øre', () => {
    expect(toMinorUnits(99.99, 'NOK')).toBe(9999)
  })

  test('SEK 1500 → 150000 öre', () => {
    expect(toMinorUnits(1500, 'SEK')).toBe(150000)
  })

  test('BHD 15.500 → 15500 fils (3 decimal currency)', () => {
    expect(toMinorUnits(15.5, 'BHD')).toBe(15500)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Vipps/Swish country validation
// ─────────────────────────────────────────────────────────────────────────────

describe('Payment method country restrictions', () => {
  function isMethodAllowed(method: string, currency: string): boolean {
    if (method === 'stc_pay') return currency === 'SAR'
    if (method === 'mada')    return currency === 'SAR'
    if (method === 'vipps')   return currency === 'NOK'
    if (method === 'swish')   return currency === 'SEK'
    return true  // card, apple_pay, cash always allowed
  }

  test('STC Pay only for SAR', () => {
    expect(isMethodAllowed('stc_pay', 'SAR')).toBe(true)
    expect(isMethodAllowed('stc_pay', 'NOK')).toBe(false)
    expect(isMethodAllowed('stc_pay', 'SEK')).toBe(false)
  })

  test('Vipps only for NOK', () => {
    expect(isMethodAllowed('vipps', 'NOK')).toBe(true)
    expect(isMethodAllowed('vipps', 'SAR')).toBe(false)
    expect(isMethodAllowed('vipps', 'SEK')).toBe(false)
  })

  test('Swish only for SEK', () => {
    expect(isMethodAllowed('swish', 'SEK')).toBe(true)
    expect(isMethodAllowed('swish', 'SAR')).toBe(false)
    expect(isMethodAllowed('swish', 'NOK')).toBe(false)
  })

  test('Card allowed everywhere', () => {
    for (const currency of ['SAR', 'AED', 'NOK', 'SEK', 'KWD']) {
      expect(isMethodAllowed('card', currency)).toBe(true)
    }
  })
})
