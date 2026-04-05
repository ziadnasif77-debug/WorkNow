// ─────────────────────────────────────────────────────────────────────────────
// billing/generateInvoice — callable Cloud Function
//
// Generates a PDF invoice for a completed order and stores it in Cloud Storage.
// Returns a signed URL (30-day validity) linking the invoice to payments/{paymentId}.
//
// Idempotent: calling twice returns the same URL if invoice already exists.
// ─────────────────────────────────────────────────────────────────────────────

import { z }                          from 'zod'
import * as admin                     from 'firebase-admin'
import { callable, requireAuth,
         validate, db, storage }      from '../_shared/helpers'
import { rateLimit }                  from '../_shared/ratelimit'
import { logger, auditLog }           from '../_shared/monitoring'
import { buildInvoicePdf }            from './pdfBuilder'
import { allocateInvoiceNumber,
         countryFromCurrency }        from './invoiceNumber'
import type { Order, Payment }        from '@workfix/types'

// ── Input schema ──────────────────────────────────────────────────────────────
const generateInvoiceSchema = z.object({
  orderId: z.string().min(1).max(128),
})

// ── Constants ─────────────────────────────────────────────────────────────────
const INVOICE_URL_EXPIRY_DAYS = 30
const VAT_RATES: Record<string, number> = {
  SA: 0.15,  // ZATCA 15%
  NO: 0.25,  // MVA 25%
  SE: 0.25,  // MOMS 25%
  AE: 0.05,  // UAE VAT 5%
  EG: 0.14,  // Egypt VAT 14%
}

// ─────────────────────────────────────────────────────────────────────────────

export const generateInvoice = callable(async (data, context) => {
  const { uid } = requireAuth(context)
  await rateLimit(uid, 'api')
  const { orderId } = validate(generateInvoiceSchema, data)

  const t0 = Date.now()

  // ── Fetch order ─────────────────────────────────────────────────────────────
  const orderSnap = await db.collection('orders').doc(orderId).get()
  if (!orderSnap.exists) {
    throw new (await import('firebase-functions')).https.HttpsError(
      'not-found', `Order ${orderId} not found`
    )
  }
  const order = orderSnap.data() as Order

  // ── Authorization: only customer, provider, or admin ────────────────────────
  const { role } = context.auth!.token as { role?: string }
  const isParty   = uid === order.customerId || uid === order.providerId
  const isAdmin   = role === 'admin' || role === 'superadmin'
  if (!isParty && !isAdmin) {
    throw new (await import('firebase-functions')).https.HttpsError(
      'permission-denied', 'Only order parties can download invoices'
    )
  }

  // ── Only closed orders have invoices ────────────────────────────────────────
  if (order.status !== 'closed') {
    throw new (await import('firebase-functions')).https.HttpsError(
      'failed-precondition',
      `Invoice only available for completed orders (current status: ${order.status})`
    )
  }

  // ── Idempotency: return cached URL if already generated ─────────────────────
  const existingInvoice = await db.collection('invoices')
    .where('orderId', '==', orderId)
    .limit(1)
    .get()

  if (!existingInvoice.empty) {
    const inv = existingInvoice.docs[0]!.data()
    // Refresh URL if within expiry window (Signed URLs expire)
    if (inv['invoiceUrl'] && new Date(inv['expiresAt']) > new Date()) {
      logger.info('Invoice already exists — returning cached URL', { orderId })
      return {
        ok:           true,
        invoiceNumber: inv['invoiceNumber'],
        invoiceUrl:   inv['invoiceUrl'],
        expiresAt:    inv['expiresAt'],
        cached:       true,
      }
    }
  }

  // ── Fetch related payment record (for payment method) ──────────────────────
  const paymentSnap = await db.collection('payments')
    .where('orderId', '==', orderId)
    .limit(1)
    .get()
  const payment = paymentSnap.empty ? null : (paymentSnap.docs[0]!.data() as Payment)

  // ── Compute financial breakdown ─────────────────────────────────────────────
  const baseAmount      = order.finalPrice ?? order.quotedPrice ?? 0
  const commissionRate  = order.commissionRate ?? 0.12
  const commissionAmount = Math.round(baseAmount * commissionRate * 100) / 100
  const countryCode     = countryFromCurrency(order.currency)
  const vatRate         = VAT_RATES[countryCode] ?? 0
  const vatAmount       = Math.round(baseAmount * vatRate * 100) / 100
  const totalAmount     = Math.round((baseAmount + vatAmount) * 100) / 100
  const netToProvider   = Math.round((baseAmount - commissionAmount) * 100) / 100

  const currencySymbols: Record<string, string> = {
    SAR: 'SAR', AED: 'AED', KWD: 'KWD', NOK: 'kr', SEK: 'kr',
  }

  // ── Allocate invoice number (atomic counter) ────────────────────────────────
  const invoiceNumber = await allocateInvoiceNumber(countryCode)

  // ── Build invoice data ──────────────────────────────────────────────────────
  const closedAt = (order.closedAt as admin.firestore.Timestamp | undefined)
    ?.toDate().toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10)

  const invoiceData = {
    invoiceNumber,
    invoiceDate:       new Date().toISOString().slice(0, 10),
    orderReference:    orderId.slice(-8).toUpperCase(),
    completedAt:       closedAt,

    customerName:      order.customerName,
    customerId:        order.customerId,
    providerName:      order.providerName ?? 'WorkFix Provider',
    providerId:        order.providerId ?? '',

    serviceName:       (order.serviceName as { en?: string; ar?: string })?.en
                       ?? (order.serviceName as { en?: string; ar?: string })?.ar
                       ?? 'Professional Service',
    serviceDescription: order.description?.slice(0, 80) ?? undefined,

    baseAmount,
    commissionRate,
    commissionAmount,
    vatRate,
    vatAmount,
    totalAmount,
    netToProvider,
    currency:          order.currency,
    currencySymbol:    currencySymbols[order.currency] ?? order.currency,

    paymentMethod:     order.paymentMethod ?? payment?.method ?? 'card',
    paymentStatus:     order.paymentStatus,

    countryCode,
    workfixVersion:    '1.0.0',
  }

  // ── Generate PDF + upload + persist (atomic: clean up storage on any failure) ─
  logger.info('Generating invoice PDF', { orderId, invoiceNumber })

  let pdfBytes: Uint8Array
  const bucket   = storage.bucket()
  const filePath = `invoices/${countryCode}/${new Date().getFullYear()}/${invoiceNumber}.pdf`
  const fileRef  = bucket.file(filePath)

  try {
    pdfBytes = await buildInvoicePdf(invoiceData)
  } catch (pdfErr) {
    logger.error('PDF generation failed', { orderId, invoiceNumber, pdfErr })
    throw new (await import('firebase-functions')).https.HttpsError(
      'internal', 'Failed to generate invoice PDF'
    )
  }

  try {
    // ── Upload to Cloud Storage ───────────────────────────────────────────────
    await fileRef.save(Buffer.from(pdfBytes), {
      contentType:  'application/pdf',
      metadata: {
        contentDisposition: `inline; filename="${invoiceNumber}.pdf"`,
        cacheControl: 'private, max-age=86400',
        metadata: {
          invoiceNumber,
          orderId,
          customerId:  order.customerId,
          providerId:  order.providerId ?? '',
          generatedAt: new Date().toISOString(),
        },
      },
    })

    // ── Generate Signed URL ───────────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + INVOICE_URL_EXPIRY_DAYS * 86_400_000)
    const [signedUrl] = await fileRef.getSignedUrl({
      action:  'read',
      expires: expiresAt,
    })

    // ── Store invoice record ──────────────────────────────────────────────────
    const invoiceRef = db.collection('invoices').doc()
    await invoiceRef.set({
      id:            invoiceRef.id,
      invoiceNumber,
      orderId,
      customerId:    order.customerId,
      providerId:    order.providerId ?? '',
      invoiceUrl:    signedUrl,
      filePath,
      fileSize:      pdfBytes.byteLength,
      expiresAt:     expiresAt.toISOString(),
      currency:      order.currency,
      totalAmount,
      vatAmount,
      vatRate,
      commissionAmount,
      countryCode,
      status:        'generated',
      createdAt:     admin.firestore.FieldValue.serverTimestamp(),
    })

    // ── Attach URL to payment record ──────────────────────────────────────────
    if (!paymentSnap.empty) {
      await paymentSnap.docs[0]!.ref.update({
        invoiceUrl:    signedUrl,
        invoiceNumber,
        updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    // ── Also attach to order ──────────────────────────────────────────────────
    await db.collection('orders').doc(orderId).update({
      invoiceUrl:    signedUrl,
      invoiceNumber,
      updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
    })

    await auditLog('invoice_generated', uid, {
      orderId, invoiceNumber, fileSize: pdfBytes.byteLength,
      elapsed: Date.now() - t0,
    })

    logger.info('Invoice generated', {
      orderId, invoiceNumber,
      fileSize: pdfBytes.byteLength,
      elapsed: Date.now() - t0,
    })

    return {
      ok:           true,
      invoiceNumber,
      invoiceUrl:   signedUrl,
      expiresAt:    expiresAt.toISOString(),
      cached:       false,
    }
  } catch (ioErr) {
    // Clean up orphaned storage file if upload succeeded but subsequent writes failed
    logger.error('Invoice I/O error — attempting storage cleanup', { orderId, invoiceNumber, ioErr })
    try { await fileRef.delete() } catch { /* best-effort cleanup */ }
    throw new (await import('firebase-functions')).https.HttpsError(
      'internal', 'Invoice generation failed during storage or database write'
    )
  }
})
