// ─────────────────────────────────────────────────────────────────────────────
// Analytics — Firebase Analytics event tracking
// All business-critical events tracked here for conversion + retention analysis
// ─────────────────────────────────────────────────────────────────────────────

// @react-native-firebase/analytics is a native module — not available in Expo Go or web.
// Fall back to a no-op stub so the app loads cleanly in those environments.
type AnalyticsInstance = {
  logEvent: (event: string, params?: Record<string, unknown>) => Promise<void>
  logPurchase: (params: Record<string, unknown>) => Promise<void>
  setUserProperty: (name: string, value: string) => Promise<void>
}

const noopAnalytics: AnalyticsInstance = {
  logEvent:        async () => undefined,
  logPurchase:     async () => undefined,
  setUserProperty: async () => undefined,
}

let _analytics: (() => AnalyticsInstance) = () => noopAnalytics
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@react-native-firebase/analytics') as { default: () => AnalyticsInstance }
  _analytics = mod.default
} catch {
  // Expo Go / web — use noop stub
}
const analytics = _analytics

const IS_PROD = process.env['EXPO_PUBLIC_ENV'] === 'production'

// ── Event names (consistent naming = reliable reports) ────────────────────────

const EVENTS = {
  // Auth funnel
  SIGN_UP_START:          'sign_up_start',
  SIGN_UP_COMPLETE:       'sign_up',          // standard Firebase event
  LOGIN:                  'login',            // standard Firebase event
  KYC_SUBMITTED:          'kyc_submitted',
  KYC_APPROVED:           'kyc_approved',

  // Marketplace
  PROVIDER_SEARCH:        'provider_search',
  PROVIDER_PROFILE_VIEW:  'provider_profile_view',
  CATEGORY_SELECTED:      'category_selected',

  // Order funnel (conversion critical)
  ORDER_STARTED:          'order_started',
  ORDER_SUBMITTED:        'order_submitted',
  QUOTE_RECEIVED:         'quote_received',
  QUOTE_ACCEPTED:         'quote_accepted',
  PAYMENT_STARTED:        'payment_started',
  PAYMENT_COMPLETE:       'purchase',         // standard Firebase ecommerce
  ORDER_COMPLETED:        'order_completed',
  ORDER_CANCELLED:        'order_cancelled',

  // Engagement
  CHAT_MESSAGE_SENT:      'chat_message_sent',
  REVIEW_SUBMITTED:       'review_submitted',
  DISPUTE_OPENED:         'dispute_opened',

  // Revenue
  SUBSCRIPTION_STARTED:   'subscription_started',
  SUBSCRIPTION_UPGRADED:  'subscription_upgraded',
  BOOST_PURCHASED:        'boost_purchased',

  // Retention
  APP_OPEN:               'app_open',         // auto-tracked by Firebase
  NOTIFICATION_TAPPED:    'notification_tapped',
} as const

type EventName = typeof EVENTS[keyof typeof EVENTS]

// ── Track function ────────────────────────────────────────────────────────────

async function track(
  event: EventName,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  if (!IS_PROD) {
    if (__DEV__) console.info(`[Analytics] ${event}`, params)
    return
  }
  try {
    await analytics().logEvent(event, params)
  } catch (err) {
    // Never crash the app for analytics
    if (__DEV__) console.warn('[Analytics] Failed:', event)
  }
}

// ── Public tracking API ───────────────────────────────────────────────────────

export const Analytics = {
  // Auth
  signUpStart: (method: 'email' | 'phone' | 'google') =>
    track(EVENTS.SIGN_UP_START, { method }),

  signUpComplete: (role: 'customer' | 'provider') =>
    track(EVENTS.SIGN_UP_COMPLETE, { method: role }),

  login: (method: string) =>
    track(EVENTS.LOGIN, { method }),

  kycSubmitted: () => track(EVENTS.KYC_SUBMITTED),
  kycApproved:  () => track(EVENTS.KYC_APPROVED),

  // Marketplace
  providerSearch: (query: string, categoryId?: string, resultsCount?: number) =>
    track(EVENTS.PROVIDER_SEARCH, {
      search_term: query.slice(0, 50),
      category_id: categoryId ?? '',
      results:     resultsCount ?? 0,
    }),

  providerProfileView: (providerId: string, source: 'search' | 'home' | 'link') =>
    track(EVENTS.PROVIDER_PROFILE_VIEW, { provider_id: providerId, source }),

  categorySelected: (categoryId: string, categoryName: string) =>
    track(EVENTS.CATEGORY_SELECTED, { category_id: categoryId, category_name: categoryName }),

  // Orders
  orderStarted: (serviceId: string, categoryId: string) =>
    track(EVENTS.ORDER_STARTED, { service_id: serviceId, category_id: categoryId }),

  orderSubmitted: (orderId: string) =>
    track(EVENTS.ORDER_SUBMITTED, { order_id: orderId }),

  quoteReceived: (orderId: string, providerId: string, amount: number) =>
    track(EVENTS.QUOTE_RECEIVED, { order_id: orderId, provider_id: providerId, value: amount }),

  quoteAccepted: (orderId: string, amount: number, currency: string) =>
    track(EVENTS.QUOTE_ACCEPTED, { order_id: orderId, value: amount, currency }),

  paymentStarted: (orderId: string, method: string, amount: number) =>
    track(EVENTS.PAYMENT_STARTED, { order_id: orderId, method, value: amount }),

  paymentComplete: (orderId: string, amount: number, currency: string) =>
    analytics().logPurchase({
      value: amount,
      currency,
      transaction_id: orderId,
    }),

  orderCompleted:  (orderId: string) => track(EVENTS.ORDER_COMPLETED, { order_id: orderId }),
  orderCancelled:  (orderId: string, reason: string) =>
    track(EVENTS.ORDER_CANCELLED, { order_id: orderId, reason: reason.slice(0, 50) }),

  // Engagement
  chatMessageSent: (orderId: string) => track(EVENTS.CHAT_MESSAGE_SENT, { order_id: orderId }),
  reviewSubmitted: (rating: number)  => track(EVENTS.REVIEW_SUBMITTED, { rating }),
  disputeOpened:   (reason: string)  => track(EVENTS.DISPUTE_OPENED, { reason: reason.slice(0, 50) }),

  // Revenue
  subscriptionStarted:  (tier: string, billing: string) =>
    track(EVENTS.SUBSCRIPTION_STARTED, { tier, billing }),
  subscriptionUpgraded: (from: string, to: string) =>
    track(EVENTS.SUBSCRIPTION_UPGRADED, { from_tier: from, to_tier: to }),

  // Notifications
  notificationTapped: (type: string) =>
    track(EVENTS.NOTIFICATION_TAPPED, { notification_type: type }),

  // User properties (for cohort analysis)
  setUserProperties: async (props: {
    role?:             string
    subscriptionTier?: string
    country?:          string
    language?:         string
  }) => {
    if (!IS_PROD) return
    const a = analytics()
    if (props.role)             await a.setUserProperty('user_role',          props.role)
    if (props.subscriptionTier) await a.setUserProperty('subscription_tier',  props.subscriptionTier)
    if (props.country)          await a.setUserProperty('country',            props.country)
    if (props.language)         await a.setUserProperty('app_language',       props.language)
  },
}


// ── initAnalytics ──────────────────────────────────────────────────────────────

export function initAnalytics(): void {
  const IS_PROD = process.env['EXPO_PUBLIC_ENV'] === 'production'
  if (!IS_PROD) {
    console.log('[Analytics] dev mode — events logged to console only')
  }
  // Firebase Analytics initializes automatically via @react-native-firebase/analytics
  // No explicit init needed — just call Analytics.* methods
}
