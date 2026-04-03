// ─────────────────────────────────────────────────────────────────────────────
// Invoice number generation — sequential, country-aware, ZATCA/VAT compliant
//
// Format:  {PREFIX}-{YEAR}-{SEQ5}
//   SA-2025-00001   → Saudi Arabia  (ZATCA compliant)
//   AE-2025-00001   → UAE
//   NO-2025-00001   → Norway        (MVA/VAT)
//   SE-2025-00001   → Sweden        (MOMS)
//   WF-2025-00001   → fallback
//
// Sequence is stored in invoiceCounters/{countryCode}-{year} and incremented
// atomically via Firestore transaction → no duplicates under concurrent load.
// ─────────────────────────────────────────────────────────────────────────────

import * as admin from 'firebase-admin'
import { db }     from '../_shared/helpers'

/** Map ISO country code → invoice prefix */
const COUNTRY_PREFIX: Record<string, string> = {
  SA: 'SA', AE: 'AE', KW: 'KW', QA: 'QA', BH: 'BH', OM: 'OM', EG: 'EG',
  NO: 'NO', SE: 'SE',
}

/**
 * Atomically allocate the next invoice number for a given country + year.
 * Returns e.g. "SA-2025-00042"
 */
export async function allocateInvoiceNumber(countryCode: string): Promise<string> {
  const year    = new Date().getFullYear()
  const prefix  = COUNTRY_PREFIX[countryCode.toUpperCase()] ?? 'WF'
  const counterId = `${prefix}-${year}`
  const counterRef = db.collection('invoiceCounters').doc(counterId)

  const seq = await db.runTransaction(async tx => {
    const snap = await tx.get(counterRef)
    const current = (snap.data() as { seq?: number } | undefined)?.seq ?? 0
    const next = current + 1
    tx.set(counterRef, { seq: next, prefix, year, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
    return next
  })

  const seqStr = String(seq).padStart(5, '0')
  return `${prefix}-${year}-${seqStr}`
}

/**
 * Derive country code from order currency (best-effort for invoice numbering).
 * Falls back to 'SA' (Saudi Arabia) if unknown.
 */
export function countryFromCurrency(currency: string): string {
  const map: Record<string, string> = {
    SAR: 'SA', AED: 'AE', KWD: 'KW', QAR: 'QA',
    BHD: 'BH', OMR: 'OM', EGP: 'EG',
    NOK: 'NO', SEK: 'SE',
  }
  return map[currency.toUpperCase()] ?? 'SA'
}
