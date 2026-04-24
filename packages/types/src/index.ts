// ─────────────────────────────────────────────────────────────────────────────
// @workfix/types — Single source of truth for all TypeScript contracts
// Used by: apps/mobile, functions/, apps/admin
// ─────────────────────────────────────────────────────────────────────────────

// ── Firestore Timestamp shim (works in both Web SDK and Admin SDK) ────────────
export interface Timestamp {
  seconds: number
  nanoseconds: number
  toDate(): Date
}

export interface GeoPoint {
  latitude: number
  longitude: number
}

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS & UNION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'customer' | 'provider' | 'admin' | 'superadmin'
export type ProviderType = 'individual' | 'company'
export type KycStatus = 'pending' | 'approved' | 'rejected' | 'resubmit'
export type SubscriptionTier = 'free' | 'pro' | 'business'

export type OrderStatus =
  | 'pending'          // created, waiting for quotes
  | 'quoted'           // at least one quote received (bidding phase)
  | 'confirmed'        // customer accepted a quote
  | 'payment_pending'  // payment initiated, awaiting gateway capture
  | 'in_progress'      // payment captured, provider is working
  | 'completed'        // provider marked done
  | 'closed'           // customer confirmed + payout released
  | 'cancelled'        // cancelled by either party
  | 'disputed'         // dispute opened

export type PaymentStatus = 'unpaid' | 'held' | 'captured' | 'refunded' | 'failed'
export type PaymentMethod =
  | 'card'
  | 'apple_pay'
  | 'stc_pay'
  | 'mada'
  | 'cash'
  | 'vipps'   // Norway
  | 'swish'   // Sweden

export type PriceType = 'fixed' | 'hourly' | 'quote_required'

export type Currency =
  // MENA
  | 'SAR' | 'AED' | 'KWD' | 'BHD' | 'OMR' | 'QAR' | 'EGP'
  // Scandinavia
  | 'NOK'  // Norwegian Krone
  | 'SEK'  // Swedish Krona

export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'resolved_customer'
  | 'resolved_provider'
  | 'closed'

export type NotificationType =
  | 'new_order'
  | 'new_quote'
  | 'quote_accepted'
  | 'payment_held'
  | 'provider_arrived'
  | 'order_completed'
  | 'payout_released'
  | 'new_message'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'subscription_renewed'
  | 'subscription_expired'

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

export interface LocalizedString {
  ar: string
  en: string
}

// ─────────────────────────────────────────────────────────────────────────────
// COLLECTIONS
// ─────────────────────────────────────────────────────────────────────────────

// ── /users/{userId} ───────────────────────────────────────────────────────────
export interface User {
  id: string
  email?: string
  phone?: string
  displayName: string
  avatarUrl?: string
  role: UserRole
  isVerified: boolean
  isActive: boolean
  fcmTokens?: string[]      // multiple devices
  preferredLang: 'ar' | 'en' | 'no' | 'sv'
  notificationPrefs?: {
    newOrder:     boolean   // provider: new order in my category
    newMessage:   boolean   // new chat message
    orderUpdates: boolean   // order status changes
    promotions:   boolean   // marketing / promos
  }
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ── /providerProfiles/{userId} ────────────────────────────────────────────────
export interface ProviderProfile {
  id: string                // = userId
  type: ProviderType
  businessName?: string     // required if type = 'company'
  bio?: string
  location: GeoPoint
  geohash: string           // computed from location for geo queries
  city: string
  country: string
  serviceIds: string[]
  categoryIds: string[]
  avgRating: number
  totalReviews: number
  totalCompletedOrders: number
  cancellationsAsProvider?: number   // orders cancelled after they were confirmed
  reputationScore?: number           // composite: avgRating*0.6 + completionRate*0.3 + activity*0.1
  kycStatus: KycStatus
  subscriptionTier: SubscriptionTier
  boostExpiresAt?: Timestamp
  isActive: boolean
  workingHours?: WorkingHours
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface WorkingHours {
  [day: string]: { open: string; close: string; isOff: boolean }
  // day: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
}

// ── /kycSubmissions/{userId} — admin-only, never in providerProfiles ──────────
export interface KycSubmission {
  providerId:   string
  documentUrls: string[]
  status:       KycStatus
  note:         string | null
  submittedAt:  Timestamp | null
  reviewedAt:   Timestamp | null
  reviewedBy:   string | null     // adminId
  createdAt:    Timestamp
  updatedAt:    Timestamp
}

// ── /categories/{categoryId} ──────────────────────────────────────────────────
export interface Category {
  id: string
  name: LocalizedString
  description?: LocalizedString
  iconUrl: string
  icon?: string             // emoji or icon character for quick display
  serviceCount?: number     // denormalized count of active services
  parentId?: string         // null = root category
  sortOrder: number
  isActive: boolean
  createdAt: Timestamp
}

// ── /services/{serviceId} ─────────────────────────────────────────────────────
export interface Service {
  id: string
  providerId: string
  categoryId: string
  title: LocalizedString
  description: LocalizedString
  basePrice: number
  priceType: PriceType
  currency: Currency
  imageUrls: string[]
  tags: string[]
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ── /orders/{orderId} ─────────────────────────────────────────────────────────
export interface Order {
  id: string
  customerId: string
  customerName: string      // denormalized for display
  customerAvatarUrl?: string
  providerId?: string       // null until a quote is accepted
  providerName?: string
  providerAvatarUrl?: string
  serviceId: string
  serviceName: LocalizedString
  categoryId: string
  status: OrderStatus
  quotedPrice?: number
  finalPrice?: number
  commissionRate: number    // e.g. 0.12
  commissionAmount?: number
  netAmount?: number        // finalPrice - commissionAmount
  paymentStatus: PaymentStatus
  paymentMethod?: PaymentMethod
  currency: Currency
  escrowPaymentId?: string  // Moyasar payment id
  location: GeoPoint
  address: string
  description: string
  attachmentUrls: string[]
  isScheduled: boolean
  scheduledAt?: Timestamp
  acceptedAt?: Timestamp
  startedAt?: Timestamp
  completedAt?: Timestamp
  closedAt?: Timestamp
  cancelledAt?: Timestamp
  cancelReason?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ── /orders/{orderId}/quotes/{quoteId} ────────────────────────────────────────
export interface Quote {
  id: string
  orderId: string
  providerId: string
  providerName: string
  providerAvatarUrl?: string
  providerRating: number
  price: number
  currency: Currency
  estimatedDurationMinutes: number
  note?: string
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  expiresAt: Timestamp
  createdAt: Timestamp
}

// ── /payments/{paymentId} ─────────────────────────────────────────────────────
export interface Payment {
  id: string
  orderId: string
  customerId: string
  providerId: string
  moyasarId: string
  amount: number
  commission: number
  netAmount: number
  status: 'initiated' | 'held' | 'captured' | 'refunded' | 'failed'
  method: PaymentMethod
  currency: Currency
  metadata?: Record<string, string>
  createdAt: Timestamp
  updatedAt: Timestamp
  capturedAt?: Timestamp
  refundedAt?: Timestamp
}

// ── /conversations/{convId} ───────────────────────────────────────────────────
export interface Conversation {
  id: string
  orderId: string
  customerId: string
  providerId: string
  lastMessageAt: Timestamp
  lastMessageText: string
  lastMessageSenderId: string
  unreadCount: Record<string, number>   // { [userId]: count }
  /**
   * TTL-based typing indicator map.
   * Each key is a userId; value is a Unix timestamp (ms) when the indicator expires.
   * Replaces the old boolean typingStatus — no delete writes needed.
   * A user is "typing" if typingExpiresAt[uid] > Date.now().
   *
   * Write cost: 1 write per burst (not 2 per write+delete cycle).
   * Cleanup: hourly Cloud Function removes stale entries.
   */
  typingExpiresAt: Record<string, number>  // { [userId]: expiresAt ms }
  /** @deprecated Use typingExpiresAt. Kept for migration compatibility. */
  typingStatus?: Record<string, boolean>
  createdAt: Timestamp
}

// ── /conversations/{convId}/messages/{msgId} ──────────────────────────────────
export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderAvatarUrl?: string
  text?: string
  mediaUrl?: string
  mediaType?: 'image' | 'document'
  isRead: boolean
  readAt?: Timestamp
  sentAt: Timestamp
}

// ── /reviews/{reviewId} ───────────────────────────────────────────────────────
export interface Review {
  id: string
  orderId: string
  reviewerId: string
  reviewerName: string
  reviewerAvatarUrl?: string
  targetId: string
  targetType: 'provider' | 'customer'
  rating: number            // 1–5
  comment?: string
  createdAt: Timestamp
}

// ── /disputes/{disputeId} ─────────────────────────────────────────────────────
export interface Dispute {
  id: string
  orderId: string
  initiatorId: string
  initiatorRole: 'customer' | 'provider'
  respondentId: string
  reason: string
  evidenceUrls: string[]
  status: DisputeStatus
  resolution?: string
  adminId?: string
  releaseToParty?: 'customer' | 'provider'
  createdAt: Timestamp
  updatedAt: Timestamp
  resolvedAt?: Timestamp
}

// ── /users/{userId}/notifications/{notifId} ───────────────────────────────────
export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: LocalizedString
  body: LocalizedString
  isRead: boolean
  refId?: string            // orderId / disputeId / etc.
  refType?: 'order' | 'dispute' | 'message' | 'payment'
  createdAt: Timestamp
}

// ── /subscriptions/{subId} ────────────────────────────────────────────────────
export interface Subscription {
  id: string
  providerId: string
  tier: SubscriptionTier
  status: 'active' | 'cancelled' | 'past_due' | 'trialing'
  moyasarSubscriptionId: string
  startAt: Timestamp
  endAt: Timestamp
  autoRenew: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ── /jobs/{jobId} ─────────────────────────────────────────────────────────────
export type JobStatus = 'open' | 'closed' | 'paused'

export interface Job {
  id: string
  providerId: string
  providerName: string
  providerAvatarUrl?: string
  title: string
  description: string           // max 2000 chars
  categoryId?: string
  location: string              // city / area text
  jobType: 'full_time' | 'part_time' | 'freelance' | 'internship'
  salaryMin?: number
  salaryMax?: number
  currency?: Currency
  requirements?: string         // skills / qualifications
  applicationDeadline?: Timestamp
  websiteUrl?: string           // optional external application URL
  status: JobStatus
  applicationsCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ── /jobApplications/{appId} ──────────────────────────────────────────────────
export type ApplicationStatus = 'pending' | 'viewed' | 'shortlisted' | 'rejected'

export interface JobApplication {
  id: string
  jobId: string
  jobTitle: string              // denormalized
  providerId: string            // job owner
  applicantId: string
  applicantName: string
  applicantEmail: string
  applicantPhone: string
  coverNote?: string            // max 1000 chars
  cvUrl?: string                // Firebase Storage URL
  cvFileName?: string           // original file name
  status: ApplicationStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCALE & COUNTRY CONFIG
// ─────────────────────────────────────────────────────────────────────────────


// ── Invoice ──────────────────────────────────────────────────────────────────
export interface Invoice {
  id:             string
  invoiceNumber:  string    // e.g. "SA-2025-00042"
  orderId:        string
  customerId:     string
  providerId:     string
  invoiceUrl:     string    // Signed URL (30 days)
  filePath:       string    // Storage path
  fileSize:       number
  expiresAt:      string    // ISO date
  currency:       Currency
  totalAmount:    number
  vatAmount:      number
  vatRate:        number
  commissionAmount: number
  countryCode:    string
  status:         'generated' | 'expired'
  createdAt:      Timestamp
}

export type SupportedLocale = 'ar' | 'en' | 'no' | 'sv'
export type TextDirection  = 'rtl' | 'ltr'

export interface CountryConfig {
  code:             string           // ISO 3166-1 alpha-2
  name:             Record<SupportedLocale, string>
  currency:         Currency
  defaultLocale:    SupportedLocale
  direction:        TextDirection
  paymentMethods:   PaymentMethod[]
  phonePrefix:      string
}

/** All markets WorkFix operates in */
export const SUPPORTED_COUNTRIES: Record<string, CountryConfig> = {
  SA: {
    code: 'SA', currency: 'SAR', defaultLocale: 'ar', direction: 'rtl',
    name: { ar: 'السعودية', en: 'Saudi Arabia', no: 'Saudi-Arabia', sv: 'Saudiarabien' },
    paymentMethods: ['card', 'apple_pay', 'stc_pay', 'mada', 'cash'],
    phonePrefix: '+966',
  },
  AE: {
    code: 'AE', currency: 'AED', defaultLocale: 'ar', direction: 'rtl',
    name: { ar: 'الإمارات', en: 'UAE', no: 'UAE', sv: 'UAE' },
    paymentMethods: ['card', 'apple_pay', 'cash'],
    phonePrefix: '+971',
  },
  KW: {
    code: 'KW', currency: 'KWD', defaultLocale: 'ar', direction: 'rtl',
    name: { ar: 'الكويت', en: 'Kuwait', no: 'Kuwait', sv: 'Kuwait' },
    paymentMethods: ['card', 'apple_pay', 'cash'],
    phonePrefix: '+965',
  },
  QA: {
    code: 'QA', currency: 'QAR', defaultLocale: 'ar', direction: 'rtl',
    name: { ar: 'قطر', en: 'Qatar', no: 'Qatar', sv: 'Qatar' },
    paymentMethods: ['card', 'apple_pay', 'cash'],
    phonePrefix: '+974',
  },
  BH: {
    code: 'BH', currency: 'BHD', defaultLocale: 'ar', direction: 'rtl',
    name: { ar: 'البحرين', en: 'Bahrain', no: 'Bahrain', sv: 'Bahrain' },
    paymentMethods: ['card', 'apple_pay', 'cash'],
    phonePrefix: '+973',
  },
  OM: {
    code: 'OM', currency: 'OMR', defaultLocale: 'ar', direction: 'rtl',
    name: { ar: 'عُمان', en: 'Oman', no: 'Oman', sv: 'Oman' },
    paymentMethods: ['card', 'apple_pay', 'cash'],
    phonePrefix: '+968',
  },
  EG: {
    code: 'EG', currency: 'EGP', defaultLocale: 'ar', direction: 'rtl',
    name: { ar: 'مصر', en: 'Egypt', no: 'Egypt', sv: 'Egypten' },
    paymentMethods: ['card', 'cash'],
    phonePrefix: '+20',
  },
  NO: {
    code: 'NO', currency: 'NOK', defaultLocale: 'no', direction: 'ltr',
    name: { ar: 'النرويج', en: 'Norway', no: 'Norge', sv: 'Norge' },
    paymentMethods: ['card', 'apple_pay', 'vipps'],
    phonePrefix: '+47',
  },
  SE: {
    code: 'SE', currency: 'SEK', defaultLocale: 'sv', direction: 'ltr',
    name: { ar: 'السويد', en: 'Sweden', no: 'Sverige', sv: 'Sverige' },
    paymentMethods: ['card', 'apple_pay', 'swish'],
    phonePrefix: '+46',
  },
}


// ─────────────────────────────────────────────────────────────────────────────

// Auth
export interface CompleteProfilePayload {
  displayName: string
  phone?: string
  preferredLang?: 'ar' | 'en'
}
export interface SetProviderTypePayload {
  type: ProviderType
  businessName?: string
}
export interface UploadKycPayload {
  documentUrls: string[]
}

// Marketplace
export interface SearchProvidersPayload {
  lat: number
  lng: number
  radiusKm: number
  categoryId?: string
  query?: string
  minRating?: number
  maxPrice?: number
  sortBy?: 'distance' | 'rating' | 'price'
  page?: number
  limit?: number
}
export interface SearchProvidersResult {
  providers: Array<ProviderProfile & { distanceKm: number }>
  total: number
  hasMore: boolean
}

// Orders
export interface CreateOrderPayload {
  serviceId: string
  categoryId: string
  location: GeoPoint
  address: string
  description: string
  attachmentUrls?: string[]
  isScheduled?: boolean
  scheduledAt?: string      // ISO string
}
export interface SubmitQuotePayload {
  orderId: string
  price: number
  estimatedDurationMinutes: number
  note?: string
}
export interface AcceptQuotePayload {
  orderId: string
  quoteId: string
}
export interface CancelOrderPayload {
  orderId: string
  reason: string
}

// Payments
export interface InitiatePaymentPayload {
  orderId: string
  method: PaymentMethod
  returnUrl?: string        // for redirect-based flows
}
export interface InitiatePaymentResult {
  moyasarToken?: string
  redirectUrl?: string
  clientSecret?: string
}
export interface RequestPayoutPayload {
  amount?: number           // partial payout; omit for full balance
}

// Messaging
export interface SendMessagePayload {
  conversationId: string
  text?: string
  mediaUrl?: string
  mediaType?: 'image' | 'document'
}

// ─────────────────────────────────────────────────────────────────────────────
// API RESPONSE WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  code: string
  message: string
  details?: unknown
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────

export const ErrorCodes = {
  // Auth
  AUTH_001: 'USER_NOT_FOUND',
  AUTH_002: 'ROLE_NOT_ALLOWED',
  AUTH_003: 'ACCOUNT_SUSPENDED',
  AUTH_004: 'KYC_NOT_APPROVED',
  AUTH_005: 'PROFILE_INCOMPLETE',

  // Orders
  ORD_001: 'ORDER_NOT_FOUND',
  ORD_002: 'INVALID_ORDER_TRANSITION',
  ORD_003: 'PROVIDER_NOT_AVAILABLE',
  ORD_004: 'QUOTE_EXPIRED',
  ORD_005: 'ORDER_ALREADY_HAS_PROVIDER',

  // Payments
  PAY_001: 'PAYMENT_FAILED',
  PAY_002: 'ESCROW_HOLD_FAILED',
  PAY_003: 'REFUND_NOT_ELIGIBLE',
  PAY_004: 'INSUFFICIENT_BALANCE',
  PAY_005: 'PAYOUT_FAILED',

  // Validation
  VAL_001: 'INVALID_INPUT',
  VAL_002: 'MISSING_REQUIRED_FIELD',
  VAL_003: 'VALUE_OUT_OF_RANGE',

  // General
  GEN_001: 'INTERNAL_SERVER_ERROR',
  GEN_002: 'RATE_LIMIT_EXCEEDED',
  GEN_003: 'FEATURE_DISABLED',
  GEN_004: 'NOT_FOUND',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]
