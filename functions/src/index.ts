// ─────────────────────────────────────────────────────────────────────────────
// WorkFix Cloud Functions — Main entry point
// All functions are lazy-loaded to minimize cold start time
// ─────────────────────────────────────────────────────────────────────────────

import * as admin from 'firebase-admin'

admin.initializeApp()

// ── Auth ──────────────────────────────────────────────────────────────────────
export { completeProfile, setProviderType, uploadKyc } from './auth'

// ── Marketplace ───────────────────────────────────────────────────────────────
export { searchProviders, getProviderProfile, updateProfile } from './marketplace'

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
export { approveKyc, resolveDispute, banUser, getFinancialReport } from './admin'

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

// ── Scheduled Jobs (Queue processor + Daily cleanup) ──────────────────────────
export { processTaskQueue, dailyCleanup, hourlyCleanup } from './_shared/queue'
