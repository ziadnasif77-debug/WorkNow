// ─────────────────────────────────────────────────────────────────────────────
// Orders Functions — full lifecycle: create → quote → confirm → complete
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import {
  callable, requireAuth, validate, db, serverTimestamp,
  appError } from '../_shared/helpers'
import { rateLimit }        from '../_shared/ratelimit'
import { isValidTransition, calcCommission, calcNetAmount } from '@workfix/utils'
import { DEFAULT_COMMISSION_RATE, QUOTE_EXPIRY_HOURS, MAX_QUOTES_PER_ORDER } from '@workfix/config'
import type { Order, Quote, Timestamp, LocalizedString } from '@workfix/types'

// ── createOrder ───────────────────────────────────────────────────────────────

const createOrderSchema = z.object({
  serviceId:      z.string().min(1),
  categoryId:     z.string().min(1),
  lat:            z.number().min(-90).max(90),
  lng:            z.number().min(-180).max(180),
  address:        z.string().min(5).max(300),
  description:    z.string().min(10).max(1000),
  attachmentUrls: z.array(z.string().url()).max(5).default([]),
  isScheduled:    z.boolean().default(false),
  scheduledAt:    z.string().datetime().optional() })

export const createOrder = callable(async (data, context) => {
  const { uid, role } = requireAuth(context, ['customer'])
  if (role !== 'customer') appError('AUTH_002', 'Only customers can create orders', 'permission-denied')
  await rateLimit(uid, 'order')

  const input = validate(createOrderSchema, data)

  // Get service info for denormalization
  const serviceDoc = await db.collection('services').doc(input.serviceId).get()
  if (!serviceDoc.exists) appError('GEN_004', 'Service not found', 'not-found')

  const serviceData = serviceDoc.data()!
  const userDoc = await db.collection('users').doc(uid).get()
  const userData = userDoc.data()!

  const orderRef = db.collection('orders').doc()
  const order: Omit<Order, 'id'> = {
    customerId:      uid,
    customerName:    userData['displayName'] as string,
    ...(userData['avatarUrl'] !== undefined && { customerAvatarUrl: userData['avatarUrl'] as string }),
    serviceId:       input.serviceId,
    serviceName:     serviceData['title'] as LocalizedString,
    categoryId:      input.categoryId,
    status:          'pending',
    commissionRate:  DEFAULT_COMMISSION_RATE,
    paymentStatus:   'unpaid',
    currency:        'SAR',
    location:        { latitude: input.lat, longitude: input.lng },
    address:         input.address,
    description:     input.description,
    attachmentUrls:  input.attachmentUrls ?? [],
    isScheduled:     input.isScheduled ?? false,
    ...(input.scheduledAt && { scheduledAt: new Date(input.scheduledAt) as unknown as Timestamp }),
    createdAt:       serverTimestamp() as unknown as Timestamp,
    updatedAt:       serverTimestamp() as unknown as Timestamp }

  await orderRef.set({ ...order, id: orderRef.id })

  return { ok: true, orderId: orderRef.id }
})

// ── submitQuote ───────────────────────────────────────────────────────────────

const submitQuoteSchema = z.object({
  orderId:                   z.string().min(1),
  price:                     z.number().positive().max(100000),
  estimatedDurationMinutes:  z.number().int().positive().max(480),
  note:                      z.string().max(500).optional() })

export const submitQuote = callable(async (data, context) => {
  const { uid, role } = requireAuth(context, ['provider'])
  if (role !== 'provider') appError('AUTH_002', 'Only providers can submit quotes', 'permission-denied')
  await rateLimit(uid, 'quote')

  const input = validate(submitQuoteSchema, data)

  // Verify order exists and is quotable
  const orderRef = db.collection('orders').doc(input.orderId)
  const orderDoc = await orderRef.get()
  if (!orderDoc.exists) appError('ORD_001', 'Order not found', 'not-found')

  const order = orderDoc.data() as Order
  if (!['pending', 'quoted'].includes(order.status)) {
    appError('ORD_002', 'This order is no longer accepting quotes')
  }

  // Offer system control: max bids + no duplicate pending quote from same provider
  const [allQuotesSnap, myQuoteSnap] = await Promise.all([
    orderRef.collection('quotes').where('status', 'in', ['pending', 'accepted']).get(),
    orderRef.collection('quotes').where('providerId', '==', uid).where('status', '==', 'pending').limit(1).get(),
  ])
  if (allQuotesSnap.size >= MAX_QUOTES_PER_ORDER) {
    appError('ORD_005', 'This order has reached the maximum number of quotes')
  }
  if (!myQuoteSnap.empty) {
    appError('ORD_002', 'You already have a pending quote for this order')
  }

  // Check KYC is approved
  const profileDoc = await db.collection('providerProfiles').doc(uid).get()
  const profile = profileDoc.data()
  if (!profile || profile['kycStatus'] !== 'approved') {
    appError('AUTH_004', 'Your KYC must be approved before accepting orders', 'permission-denied')
  }

  const providerDoc = await db.collection('users').doc(uid).get()
  const providerData = providerDoc.data()!

  const quoteRef = orderRef.collection('quotes').doc()
  const expiresAt = new Date(Date.now() + QUOTE_EXPIRY_HOURS * 3600 * 1000)

  const quote: Omit<Quote, 'id'> = {
    orderId:                  input.orderId,
    providerId:               uid,
    providerName:             providerData['displayName'] as string,
    ...(providerData['avatarUrl'] !== undefined && { providerAvatarUrl: providerData['avatarUrl'] as string }),
    providerRating:           profile['avgRating'] as number,
    price:                    input.price,
    currency:                 'SAR',
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    ...(input.note !== undefined && { note: input.note }),
    status:                   'pending',
    expiresAt:                expiresAt as unknown as Timestamp,
    createdAt:                serverTimestamp() as unknown as Timestamp }

  await quoteRef.set({ ...quote, id: quoteRef.id })

  // Update order status to quoted
  await orderRef.update({
    status: 'quoted',
    updatedAt: serverTimestamp() })

  return { ok: true, quoteId: quoteRef.id }
})

// ── acceptQuote ───────────────────────────────────────────────────────────────

const acceptQuoteSchema = z.object({
  orderId:  z.string().min(1),
  quoteId:  z.string().min(1) })

export const acceptQuote = callable(async (data, context) => {
  const { uid } = requireAuth(context, ['customer'])
  await rateLimit(uid, 'api')
  const input = validate(acceptQuoteSchema, data)

  const orderRef = db.collection('orders').doc(input.orderId)
  const orderDoc = await orderRef.get()
  if (!orderDoc.exists) appError('ORD_001', 'Order not found', 'not-found')

  const order = orderDoc.data() as Order
  if (order.customerId !== uid) {
    appError('AUTH_002', 'You are not the owner of this order', 'permission-denied')
  }
  if (!isValidTransition(order.status, 'confirmed')) {
    appError('ORD_002', `Cannot confirm order in status '${order.status}'`)
  }

  const quoteRef = orderRef.collection('quotes').doc(input.quoteId)
  const quoteDoc = await quoteRef.get()
  if (!quoteDoc.exists) appError('GEN_004', 'Quote not found', 'not-found')

  const quote = quoteDoc.data() as Quote
  if (quote.status !== 'pending') appError('ORD_004', 'This quote is no longer valid')
  if ((quote.expiresAt as unknown as Date) < new Date()) {
    appError('ORD_004', 'This quote has expired')
  }

  const commission = calcCommission(quote.price, order.commissionRate)
  const netAmount = calcNetAmount(quote.price, order.commissionRate)

  // Run as a transaction to ensure atomicity
  await db.runTransaction(async tx => {
    // Accept this quote, reject all others
    const allQuotes = await orderRef.collection('quotes').get()
    allQuotes.docs.forEach(doc => {
      if (doc.id === input.quoteId) {
        tx.update(doc.ref, { status: 'accepted' })
      } else if (doc.data()['status'] === 'pending') {
        tx.update(doc.ref, { status: 'rejected' })
      }
    })

    tx.update(orderRef, {
      status:           'confirmed',
      providerId:       quote.providerId,
      providerName:     quote.providerName,
      providerAvatarUrl: quote.providerAvatarUrl,
      quotedPrice:      quote.price,
      finalPrice:       quote.price,
      commissionAmount: commission,
      netAmount,
      acceptedAt:       serverTimestamp(),
      updatedAt:        serverTimestamp() })
  })

  return {
    ok: true,
    paymentRequired: {
      amount:   quote.price,
      currency: 'SAR',
      orderId:  input.orderId } }
})

// ── confirmCompletion ─────────────────────────────────────────────────────────

const confirmCompletionSchema = z.object({
  orderId: z.string().min(1) })

export const confirmCompletion = callable(async (data, context) => {
  const { uid } = requireAuth(context, ['customer'])
  await rateLimit(uid, 'api')
  const input = validate(confirmCompletionSchema, data)

  const orderRef = db.collection('orders').doc(input.orderId)
  const orderDoc = await orderRef.get()
  if (!orderDoc.exists) appError('ORD_001', 'Order not found', 'not-found')

  const order = orderDoc.data() as Order
  if (order.customerId !== uid) {
    appError('AUTH_002', 'You are not the owner of this order', 'permission-denied')
  }
  if (!isValidTransition(order.status, 'closed')) {
    appError('ORD_002', `Cannot close order in status '${order.status}'`)
  }

  await orderRef.update({
    status:    'closed',
    closedAt:  serverTimestamp(),
    updatedAt: serverTimestamp() })

  // Payout is triggered by the onOrderStatusChanged trigger

  return { ok: true }
})

// ── markOrderComplete ─────────────────────────────────────────────────────────
// Provider marks "I have finished the work" → in_progress → completed
// Customer then calls confirmCompletion() → completed → closed

const markOrderCompleteSchema = z.object({
  orderId: z.string().min(1),
})

export const markOrderComplete = callable(async (data, context) => {
  const { uid, role } = requireAuth(context, ['provider'])
  if (role !== 'provider') appError('AUTH_002', 'Only providers can mark orders complete', 'permission-denied')
  await rateLimit(uid, 'api')

  const input = validate(markOrderCompleteSchema, data)

  const orderRef = db.collection('orders').doc(input.orderId)
  const orderDoc = await orderRef.get()
  if (!orderDoc.exists) appError('ORD_001', 'Order not found', 'not-found')

  const order = orderDoc.data() as Order
  if (order.providerId !== uid) {
    appError('AUTH_002', 'You are not the provider for this order', 'permission-denied')
  }
  if (!isValidTransition(order.status, 'completed')) {
    appError('ORD_002', `Cannot mark complete from status '${order.status}'`)
  }

  await orderRef.update({
    status:      'completed',
    completedAt: serverTimestamp(),
    updatedAt:   serverTimestamp(),
  })

  return { ok: true }
})

// ── cancelOrder ───────────────────────────────────────────────────────────────

const cancelOrderSchema = z.object({
  orderId: z.string().min(1),
  reason:  z.string().min(5).max(500) })

export const cancelOrder = callable(async (data, context) => {
  const { uid, role } = requireAuth(context)
  await rateLimit(uid, 'api')
  const input = validate(cancelOrderSchema, data)

  const orderRef = db.collection('orders').doc(input.orderId)
  const orderDoc = await orderRef.get()
  if (!orderDoc.exists) appError('ORD_001', 'Order not found', 'not-found')

  const order = orderDoc.data() as Order

  // Only customer or provider of this order can cancel
  const isCustomer = order.customerId === uid && role === 'customer'
  const isProvider = order.providerId === uid && role === 'provider'
  if (!isCustomer && !isProvider && !['admin', 'superadmin'].includes(role)) {
    appError('AUTH_002', 'You cannot cancel this order', 'permission-denied')
  }

  if (!isValidTransition(order.status, 'cancelled')) {
    appError('ORD_002', `Cannot cancel order in status '${order.status}'`)
  }

  // If payment was already held, refund is triggered in the payments function
  await orderRef.update({
    status:        'cancelled',
    cancelReason:  input.reason,
    cancelledAt:   serverTimestamp(),
    updatedAt:     serverTimestamp() })

  return { ok: true }
})
