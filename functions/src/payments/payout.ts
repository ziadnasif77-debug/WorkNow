// ─────────────────────────────────────────────────────────────────────────────
// processPayout — internal helper called by the task queue for automated payouts
// ─────────────────────────────────────────────────────────────────────────────

import { db, serverTimestamp, appError } from '../_shared/helpers'
import { logger } from '../_shared/monitoring'
import { tapRequest } from '../_shared/tapClient'

/**
 * Execute an automated payout for a provider.
 * Called by the 'process_payout' queue task handler.
 *
 * @param providerId  UID of the provider to pay out
 * @param amount      Amount in local currency units (not minor units)
 */
export async function processPayout(providerId: string, amount: number): Promise<void> {
  const profileDoc = await db.collection('providerProfiles').doc(providerId).get()
  const iban = profileDoc.data()?.['bankIban'] as string | undefined

  if (!iban) {
    logger.error('process_payout: no IBAN on file', { providerId })
    appError('VAL_002', `Provider ${providerId} has no bank IBAN on file`)
  }

  const apiKey = process.env['TAP_SECRET_KEY']
  if (!apiKey) throw new Error('TAP_SECRET_KEY missing')

  // Determine currency from most recent captured payment for this provider
  const recentPayment = await db.collection('payments')
    .where('providerId', '==', providerId)
    .where('status', '==', 'captured')
    .limit(1)
    .get()
  const currency = recentPayment.docs[0]?.data()['currency'] ?? 'SAR'

  const transfer = await tapRequest('POST', '/transfers', {
    amount:      Math.round(amount * 100),
    currency,
    description: `WorkFix auto-payout for provider ${providerId}`,
    destination: { iban },
  })

  await db.collection('payouts').add({
    providerId,
    amount,
    tapId:       transfer['id'],
    status:      'processing',
    requestedAt: serverTimestamp(),
    updatedAt:   serverTimestamp(),
  })

  logger.payment('auto_payout_initiated', { providerId, amount, tapId: transfer['id'] })
}
