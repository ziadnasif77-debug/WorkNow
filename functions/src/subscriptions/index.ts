// ─────────────────────────────────────────────────────────────────────────────
// Subscriptions Cloud Functions
// ─────────────────────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions'
import { z } from 'zod'
import { callable, requireAuth, validate, db, auth, serverTimestamp } from '../_shared/helpers'
import type { SubscriptionTier } from '@workfix/types'

const SUBSCRIPTION_PRICES: Record<SubscriptionTier, { monthly: number; yearly: number }> = {
  free:     { monthly: 0,    yearly: 0 },
  pro:      { monthly: 9900, yearly: 99900 },    // in halalas
  business: { monthly: 29900, yearly: 299900 } }

export const createSubscription = callable(async (data, context) => {
  const { uid } = requireAuth(context, ['provider'])

  const input = validate(z.object({
    tier:    z.enum(['free', 'pro', 'business']),
    billing: z.enum(['monthly', 'yearly']) }), data)

  if (input.tier === 'free') {
    // Downgrade to free — cancel existing subscription
    const existingSubs = await db.collection('subscriptions')
      .where('providerId', '==', uid)
      .where('status', '==', 'active')
      .limit(1)
      .get()

    if (!existingSubs.empty) {
      await existingSubs.docs[0]!.ref.update({
        status:    'cancelled',
        updatedAt: serverTimestamp() })
    }

    await db.collection('providerProfiles').doc(uid).update({
      subscriptionTier: 'free',
      updatedAt: serverTimestamp() })
    await auth.setCustomUserClaims(uid, { subscriptionTier: 'free' })

    return { ok: true }
  }

  const priceHalalas = SUBSCRIPTION_PRICES[input.tier as SubscriptionTier][input.billing]
  const apiKey = process.env['TAP_SECRET_KEY']
  if (!apiKey) throw new Error('TAP_SECRET_KEY missing')

  // Create Tap recurring subscription
  const res = await fetch('https://api.tap.company/v2/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      amount:       priceHalalas,
      currency:     'SAR',
      description:  `WorkFix ${input.tier} subscription`,
      interval: {
        period: input.billing === 'monthly' ? 1 : 12,
        type:   'MONTH' },
      metadata: {
        provider_id: uid,
        tier:        input.tier,
        billing:     input.billing },
      redirect: { url: `https://workfix.app/subscription/callback?uid=${uid}&tier=${input.tier}` } }) })

  const tapSub = await res.json() as { id: string; transaction?: { url?: string } }

  // Store pending subscription
  const subRef = db.collection('subscriptions').doc()
  await subRef.set({
    id:                    subRef.id,
    providerId:            uid,
    tier:                  input.tier,
    billing:               input.billing,
    status:                'pending',
    tapSubscriptionId:     tapSub.id,
    startAt:               serverTimestamp(),
    endAt:                 null,
    autoRenew:             true,
    createdAt:             serverTimestamp(),
    updatedAt:             serverTimestamp() })

  return {
    ok:           true,
    redirectUrl:  tapSub.transaction?.url,
    subscriptionId: subRef.id }
})

// ── Tap subscription webhook ───────────────────────────────────────────────────

export const tapSubscriptionWebhook = functions
  .region('me-central1')
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }

    // ── Verify HMAC-SHA256 signature ────────────────────────────────────────────
    // Same secret used for payment webhook — stored in Firebase Functions config.
    // Without this, any attacker can forge a webhook and upgrade any user for free.
    const webhookSecret = process.env['TAP_WEBHOOK_SECRET']
    if (!webhookSecret) {
      functions.logger.error('TAP_WEBHOOK_SECRET not configured')
      res.status(500).send('Server misconfigured')
      return
    }

    const { parseTapWebhook } = await import('../_shared/webhooks')
    const { verified, body } = parseTapWebhook(req, webhookSecret)

    if (!verified) {
      functions.logger.warn('Invalid Tap subscription webhook signature', { ip: req.ip })
      res.status(401).json({ error: 'Invalid signature' })
      return
    }

    const event = body as {
      status: string
      metadata?: { provider_id?: string; tier?: string }
      id: string
    }

    functions.logger.info('Tap subscription webhook', { status: event.status, id: event.id })

    try {
    if (event.status === 'ACTIVE') {
      const uid  = event.metadata?.provider_id
      const tier = event.metadata?.tier as SubscriptionTier | undefined

      if (uid && tier) {
        const endDate = new Date()
        endDate.setMonth(endDate.getMonth() + 1)

        // Verify the subscription document belongs to this provider before updating.
        // Prevents an attacker from reusing another provider's tapSubscriptionId.
        const subQuery = await db.collection('subscriptions')
          .where('tapSubscriptionId', '==', event.id)
          .where('providerId', '==', uid)          // ← ownership check
          .limit(1).get()

        if (!subQuery.empty) {
          await subQuery.docs[0]!.ref.update({
            status: 'active',
            endAt:  endDate,
            updatedAt: serverTimestamp() })
        } else {
          functions.logger.warn('Subscription webhook: no matching sub for provider', { uid, tapId: event.id })
        }

        // Update provider profile + claims
        await db.collection('providerProfiles').doc(uid).update({
          subscriptionTier: tier,
          updatedAt: serverTimestamp() })

        const { auth: adminAuth } = await import('firebase-admin')
        // getUser throws if uid is invalid — wrap separately for clear error
        let existingClaims: Record<string, unknown> = {}
        try {
          existingClaims = (await adminAuth().getUser(uid)).customClaims ?? {}
        } catch (userErr) {
          functions.logger.error('Subscription webhook: getUser failed', { uid, err: userErr })
          res.status(200).json({ received: true })   // still ack to Tap
          return
        }
        await adminAuth().setCustomUserClaims(uid, { ...existingClaims, subscriptionTier: tier })
      }
    }

    } catch (err) {
      functions.logger.error('Subscription webhook error', { err })
    }
    res.status(200).json({ received: true })
  })
