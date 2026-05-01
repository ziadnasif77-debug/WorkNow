// ─────────────────────────────────────────────────────────────────────────────
// WorkFix Cloud Functions — Main entry point
// All functions are lazy-loaded to minimize cold start time
// ─────────────────────────────────────────────────────────────────────────────

import * as firebaseAdmin from 'firebase-admin'

firebaseAdmin.initializeApp()

// ── Auth ──────────────────────────────────────────────────────────────────────
// Namespace export creates: auth-completeProfile, auth-setProviderType
import { completeProfile, setProviderType, uploadKyc } from './auth'
export const auth = { completeProfile, setProviderType }
export { uploadKyc }  // called as 'uploadKyc' (no prefix)

// ── Marketplace ───────────────────────────────────────────────────────────────
export { searchProviders, getProviderProfile, updateProfile, getProviderStats, getMyServices } from './marketplace'

// ── Orders ────────────────────────────────────────────────────────────────────
export {
  createOrder,
  submitQuote,
  acceptQuote,
  markOrderComplete,
  confirmCompletion,
  cancelOrder,
} from './orders'

// ── Payments ──────────────────────────────────────────────────────────────────
export {
  initiatePayment,
  tapWebhook,
  requestPayout,
  getWalletBalance,
} from './payments'

// ── Messaging ─────────────────────────────────────────────────────────────────
export {
  getOrCreateConversation,
  sendMessage,
  markRead,
} from './messaging'

// ── Notifications ─────────────────────────────────────────────────────────────
export { registerFcmToken, updateNotificationPreferences } from './notifications'

// ── Admin ─────────────────────────────────────────────────────────────────────
// Namespace export creates: admin-approveKyc, admin-banUser, admin-resolveDispute, admin-getFinancialReport
import { approveKyc, resolveDispute, banUser, getFinancialReport } from './admin'
export const admin = { approveKyc, resolveDispute, banUser, getFinancialReport }

// ── Subscriptions ─────────────────────────────────────────────────────────────
export { createSubscription, tapSubscriptionWebhook } from './subscriptions'

// ── Reviews + Disputes ────────────────────────────────────────────────────────
export { submitReview, openDispute } from './reviews'
export {
  onOrderStatusChanged,
  onOrderCreated,
  onQuoteCreated,
  onPaymentCaptured,
  onMessageCreated,
} from './triggers'



// ── Billing / Invoices ───────────────────────────────────────────────────────
export { generateInvoice } from './billing'

// ── User / GDPR ───────────────────────────────────────────────────────────────
export {
  requestDataExport,
  requestAccountDeletion,
  cancelAccountDeletion,
} from './user'

// ── Jobs ──────────────────────────────────────────────────────────────────────
export {
  createJob,
  applyToJob,
  getJobApplications,
  updateJobStatus,
  listJobs,
} from './jobs'

// ── Scheduled Jobs (Queue processor + Daily cleanup + Weekly integrity) ───────
export { processTaskQueue, dailyCleanup, hourlyCleanup, weeklyRatingIntegrityCheck } from './_shared/queue'
