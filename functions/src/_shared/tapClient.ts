// ─────────────────────────────────────────────────────────────────────────────
// tapClient.ts — Tap Payments API helpers (extracted from payments/index.ts)
// ─────────────────────────────────────────────────────────────────────────────

// Note: using string types for flexibility — PaymentMethod/Currency validated upstream

const TAP_BASE = 'https://api.tap.company/v2'

function tapHeaders() {
  const apiKey = process.env['TAP_SECRET_KEY']
  if (!apiKey) throw new Error('TAP_SECRET_KEY missing')
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

export async function tapRequest(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const apiKey = process.env['TAP_SECRET_KEY']
  if (!apiKey) throw new Error('TAP_SECRET_KEY is not configured')

  const res = await fetch(`${TAP_BASE}${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    ...(body && { body: JSON.stringify(body) }),
  })

  const data = await res.json() as Record<string, unknown>
  if (!res.ok) {
    console.error('Tap Payments API error', { path, status: res.status, data })
    throw new Error(`Tap error: ${String(data['message'] ?? 'Unknown')}`)
  }
  return data
}

export function toTapSource(method: string, currency: string): Record<string, string> { // method: PaymentMethod, currency: Currency
  const map: Record<string, string> = {
    card:      'src_card',
    apple_pay: 'src_apple_pay',
    stc_pay:   'src_stc_pay',
    mada:      'src_card',     // Mada is a card type — flagged via BIN
    vipps:     'src_vipps',    // Norway only
    swish:     'src_swish',    // Sweden only
    cash:      'src_cash',     // handled offline, no Tap call
  }
  return { type: map[method] ?? 'src_card', currency }
}
