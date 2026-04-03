// ─────────────────────────────────────────────────────────────────────────────
// E2E Tests — WorkFix critical user flows
// Framework: Detox (React Native E2E testing)
// Run: npx detox test --configuration ios.sim.debug
//
// Prerequisites:
//   1. iOS Simulator running (or Android Emulator)
//   2. Firebase Emulators running: pnpm emulators
//   3. Expo dev build: eas build --profile development
// ─────────────────────────────────────────────────────────────────────────────

describe('WorkFix E2E — Critical User Flows', () => {

  // ── Flow 1: Customer Registration ─────────────────────────────────────────

  describe('Flow 1: Customer registers and sets up profile', () => {
    test('onboarding → register → profile complete', async () => {
      // Skip onboarding
      await element(by.id('onboarding-skip')).tap()

      // Navigate to register
      await element(by.id('goto-register')).tap()
      await expect(element(by.id('register-screen'))).toBeVisible()

      // Fill name + email + password
      await element(by.id('input-name')).typeText('Ahmed Test')
      await element(by.id('input-email')).typeText('test+e2e@workfix.app')
      await element(by.id('input-password')).typeText('Test1234!')
      await element(by.id('btn-next')).tap()

      // Select customer role
      await element(by.id('role-customer')).tap()
      await element(by.id('btn-create-account')).tap()

      // Should reach home tab
      await expect(element(by.id('home-screen'))).toBeVisible()
    })
  })

  // ── Flow 2: Provider Registration + KYC ──────────────────────────────────

  describe('Flow 2: Provider registers and submits KYC', () => {
    test('register as provider → upload KYC → pending screen', async () => {
      await element(by.id('onboarding-skip')).tap()
      await element(by.id('goto-register')).tap()

      await element(by.id('input-name')).typeText('Mohammed Provider')
      await element(by.id('input-phone')).typeText('+966501234567')
      await element(by.id('btn-next')).tap()

      // Select provider role
      await element(by.id('role-provider')).tap()
      await element(by.id('btn-create-account')).tap()

      // Should reach provider type screen
      await expect(element(by.id('provider-type-screen'))).toBeVisible()

      // Select individual
      await element(by.id('type-individual')).tap()
      await element(by.id('btn-next')).tap()

      // KYC screen — tap add document (picker won't work in test, just verify screen)
      await expect(element(by.id('kyc-screen'))).toBeVisible()
      await expect(element(by.id('btn-add-document'))).toBeVisible()
    })
  })

  // ── Flow 3: Customer searches for provider ────────────────────────────────

  describe('Flow 3: Customer searches and views provider', () => {
    test('home → search → filter → view profile', async () => {
      // Assume logged in as customer
      await expect(element(by.id('home-screen'))).toBeVisible()

      // Tap search bar
      await element(by.id('search-bar')).tap()
      await element(by.id('search-input')).typeText('سباكة')

      // Should show results
      await waitFor(element(by.id('provider-list'))).toBeVisible().withTimeout(5000)

      // Open filters
      await element(by.id('filter-btn')).tap()
      await expect(element(by.id('filter-modal'))).toBeVisible()

      // Apply distance filter
      await element(by.id('radius-20')).tap()
      await element(by.id('btn-apply-filters')).tap()

      // Tap first provider
      await element(by.id('provider-card')).atIndex(0).tap()
      await expect(element(by.id('provider-profile-screen'))).toBeVisible()

      // Check profile sections visible
      await expect(element(by.id('provider-stats'))).toBeVisible()
      await expect(element(by.id('btn-book-now'))).toBeVisible()
    })
  })

  // ── Flow 4: Create Order ──────────────────────────────────────────────────

  describe('Flow 4: Customer creates an order', () => {
    test('provider profile → create order → wizard complete', async () => {
      await expect(element(by.id('provider-profile-screen'))).toBeVisible()
      await element(by.id('btn-book-now')).tap()

      // Step 1: describe
      await expect(element(by.id('create-order-step-1'))).toBeVisible()
      await element(by.id('description-input')).typeText('There is a leak under the kitchen sink')
      await element(by.id('btn-next-step'))).tap()

      // Step 2: location
      await expect(element(by.id('create-order-step-2'))).toBeVisible()
      await element(by.id('address-input')).clearText()
      await element(by.id('address-input')).typeText('King Fahd Road, Riyadh')
      await element(by.id('btn-next-step')).tap()

      // Step 3: schedule
      await expect(element(by.id('create-order-step-3'))).toBeVisible()
      await element(by.id('schedule-now')).tap()

      // Summary visible
      await expect(element(by.id('order-summary'))).toBeVisible()
      await element(by.id('btn-submit-order')).tap()

      // Should navigate to order detail
      await waitFor(element(by.id('order-detail-screen'))).toBeVisible().withTimeout(8000)
      await expect(element(by.id('order-status-pending'))).toBeVisible()
    })
  })

  // ── Flow 5: Messaging ─────────────────────────────────────────────────────

  describe('Flow 5: Customer chats with provider', () => {
    test('order detail → open chat → send message', async () => {
      await expect(element(by.id('order-detail-screen'))).toBeVisible()
      await element(by.id('btn-chat')).tap()

      await expect(element(by.id('chat-screen'))).toBeVisible()

      await element(by.id('message-input')).typeText('متى يمكنك الحضور؟')
      await element(by.id('btn-send')).tap()

      // Message should appear in list
      await waitFor(element(by.text('متى يمكنك الحضور؟')))
        .toBeVisible().withTimeout(3000)
    })
  })

  // ── Flow 6: Payment ───────────────────────────────────────────────────────

  describe('Flow 6: Customer pays for order', () => {
    test('accept quote → select payment method → payment screen', async () => {
      // Navigate to order with a quote
      await element(by.id('tab-orders')).tap()
      await element(by.id('order-card')).atIndex(0).tap()

      await expect(element(by.id('quote-card'))).toBeVisible()
      await element(by.id('btn-accept-quote')).tap()

      // Payment screen
      await expect(element(by.id('payment-screen'))).toBeVisible()
      await expect(element(by.id('payment-total'))).toBeVisible()
      await expect(element(by.id('escrow-notice'))).toBeVisible()

      // Select card payment
      await element(by.id('payment-method-card')).tap()
      await expect(element(by.id('payment-method-card-selected'))).toBeVisible()

      // Tap pay button
      await expect(element(by.id('btn-pay-now'))).toBeVisible()
    })
  })

  // ── Flow 7: Language switch ───────────────────────────────────────────────

  describe('Flow 7: Language switch works correctly', () => {
    test('switch from AR to EN → UI updates instantly', async () => {
      await element(by.id('tab-profile')).tap()
      await element(by.id('language-section')).tap()

      // Current: Arabic
      await expect(element(by.id('lang-ar-selected'))).toBeVisible()

      // Switch to English (same direction — no reload)
      await element(by.id('lang-en')).tap()

      // UI should update without reload
      await expect(element(by.id('profile-screen'))).toBeVisible()
      // Verify English text
      await expect(element(by.text('Account'))).toBeVisible()
    })

    test('switch from EN to AR → app reloads (RTL)', async () => {
      await element(by.id('lang-ar')).tap()

      // App reloads — wait for home screen in Arabic
      await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(10000)
    })
  })

  // ── Flow 8: Notifications ─────────────────────────────────────────────────

  describe('Flow 8: Notifications navigate correctly', () => {
    test('tap order notification → navigates to order detail', async () => {
      await element(by.id('notification-bell')).tap()
      await expect(element(by.id('notifications-screen'))).toBeVisible()

      // Tap first notification
      await element(by.id('notification-row')).atIndex(0).tap()

      // Should navigate to relevant screen
      await waitFor(element(by.id('order-detail-screen')))
        .toBeVisible().withTimeout(3000)
    })
  })
})
