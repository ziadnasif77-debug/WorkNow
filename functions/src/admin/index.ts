// ─────────────────────────────────────────────────────────────────────────────
// Admin Functions — KYC, disputes, user management, financial reports
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import { callable, requireAuth, validate, db, auth, serverTimestamp, appError } from '../_shared/helpers'
import { logger, auditLog } from '../_shared/monitoring'
import type { Dispute } from '@workfix/types'

// ── approveKyc ────────────────────────────────────────────────────────────────

export const approveKyc = callable(async (data, context) => {
  requireAuth(context, ['admin', 'superadmin'])

  const input = validate(z.object({
    providerId: z.string().min(1),
    decision:   z.enum(['approved', 'rejected', 'resubmit']),
    note:       z.string().max(500).optional(),
  }), data)

  await db.collection('providerProfiles').doc(input.providerId).update({
    kycStatus:  input.decision,
    kycNote:    input.note,
    isActive:   input.decision === 'approved',
    updatedAt:  serverTimestamp(),
  })

  // Update Custom Claims
  await auth.setCustomUserClaims(input.providerId, {
    role:        'provider',
    kycStatus:   input.decision,
    verified:    input.decision === 'approved',
  })

  // Notify provider
  const notifTitle = input.decision === 'approved'
    ? 'تم الموافقة على حسابك'
    : input.decision === 'rejected'
      ? 'تم رفض طلبك'
      : 'يرجى إعادة رفع المستندات'

  const notifBody = input.note ?? (
    input.decision === 'approved'
      ? 'يمكنك الآن استقبال الطلبات.'
      : 'تواصل مع الدعم لمزيد من المعلومات.'
  )

  await db.collection('users').doc(input.providerId)
    .collection('notifications').add({
      userId:    input.providerId,
      type:      input.decision === 'approved' ? 'kyc_approved' : 'kyc_rejected',
      title:     { ar: notifTitle, en: notifTitle },
      body:      { ar: notifBody, en: notifBody },
      isRead:    false,
      createdAt: serverTimestamp(),
    })

  return { ok: true, decision: input.decision }
})

// ── resolveDispute ────────────────────────────────────────────────────────────

export const resolveDispute = callable(async (data, context) => {
  const { uid: adminId } = requireAuth(context, ['admin', 'superadmin'])

  const input = validate(z.object({
    disputeId:      z.string().min(1),
    resolution:     z.string().min(10).max(1000),
    releaseToParty: z.enum(['customer', 'provider']),
  }), data)

  const disputeRef = db.collection('disputes').doc(input.disputeId)
  const disputeDoc = await disputeRef.get()
  if (!disputeDoc.exists) appError('GEN_004', 'Dispute not found', 'not-found')

  const dispute = disputeDoc.data() as Dispute
  if (dispute.status !== 'open' && dispute.status !== 'under_review') {
    appError('ORD_002', 'This dispute is already resolved')
  }

  const orderRef = db.collection('orders').doc(dispute.orderId)
  const orderDoc = await orderRef.get()
  if (!orderDoc.exists) appError('ORD_001', 'Order not found', 'not-found')

  const _order = orderDoc.data()!

  await db.runTransaction(async tx => {
    // Resolve dispute
    tx.update(disputeRef, {
      status:          `resolved_${input.releaseToParty}`,
      resolution:      input.resolution,
      releaseToParty:  input.releaseToParty,
      adminId,
      resolvedAt:      serverTimestamp(),
      updatedAt:       serverTimestamp(),
    })

    // Close order
    tx.update(orderRef, {
      status:    input.releaseToParty === 'customer' ? 'cancelled' : 'closed',
      updatedAt: serverTimestamp(),
    })
  })

  // The order status change trigger handles escrow release / refund
  await auditLog('dispute_resolved', adminId, {
    disputeId:      input.disputeId,
    orderId:        dispute.orderId,
    releaseToParty: input.releaseToParty,
    resolution:     input.resolution.slice(0, 100),
  })
  logger.info('Dispute resolved', { disputeId: input.disputeId, releaseToParty: input.releaseToParty })

  return { ok: true, releaseToParty: input.releaseToParty }
})

// ── banUser ───────────────────────────────────────────────────────────────────

export const banUser = callable(async (data, context) => {
  const { uid: adminId } = requireAuth(context, ['admin', 'superadmin'])

  const input = validate(z.object({
    userId: z.string().min(1),
    reason: z.string().min(5).max(500),
    ban:    z.boolean().default(true),
  }), data)

  await auth.updateUser(input.userId, { disabled: input.ban ?? true })

  await db.collection('users').doc(input.userId).update({
    isActive:  !input.ban,
    banReason: input.ban ? input.reason : null,
    updatedAt: serverTimestamp(),
  })

  await auditLog(input.ban ? 'user_banned' : 'user_unbanned', adminId, {
    targetUserId: input.userId,
    reason:       input.reason.slice(0, 100),
  })
  logger.security(input.ban ? 'user_banned' : 'user_unbanned', {
    targetUserId: input.userId, adminId,
  })

  return { ok: true, banned: input.ban }
})

// ── getFinancialReport ────────────────────────────────────────────────────────

export const getFinancialReport = callable(async (data, context) => {
  requireAuth(context, ['admin', 'superadmin'])

  const input = validate(z.object({
    from: z.string().datetime(),
    to:   z.string().datetime(),
  }), data)

  const fromDate = new Date(input.from)
  const toDate   = new Date(input.to)

  const paymentsSnap = await db.collection('payments')
    .where('status', '==', 'captured')
    .where('createdAt', '>=', fromDate)
    .where('createdAt', '<=', toDate)
    .get()

  let totalGross      = 0
  let totalCommission = 0
  let totalNet        = 0

  paymentsSnap.docs.forEach(doc => {
    const p = doc.data()
    totalGross      += p['amount']      as number
    totalCommission += p['commission']  as number
    totalNet        += p['netAmount']   as number
  })

  return {
    ok: true,
    period: { from: input.from, to: input.to },
    summary: {
      totalTransactions: paymentsSnap.size,
      totalGross:        Math.round(totalGross * 100) / 100,
      totalCommission:   Math.round(totalCommission * 100) / 100,
      totalNetToPayout:  Math.round(totalNet * 100) / 100,
      currency:          'SAR',
    },
  }
})
