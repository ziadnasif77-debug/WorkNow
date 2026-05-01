// Auth flow smoke test — verifies the login screen is reachable and basic
// interaction works. Runs against the debug APK built in CI.

describe('Auth flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  it('shows the login screen on cold start', async () => {
    await expect(element(by.id('login-screen'))).toBeVisible()
  })

  it('shows phone input field', async () => {
    await expect(element(by.id('phone-input'))).toBeVisible()
  })

  it('shows error for invalid phone number', async () => {
    await element(by.id('phone-input')).typeText('123')
    await element(by.id('login-btn')).tap()
    await expect(element(by.id('phone-error'))).toBeVisible()
  })
})
