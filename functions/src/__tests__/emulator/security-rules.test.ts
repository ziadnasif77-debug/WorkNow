// ─────────────────────────────────────────────────────────────────────────────
// Security Rules Tests — Firestore access control
// Uses @firebase/rules-unit-testing with local emulator
// Run via: pnpm --filter @workfix/functions test:rules
//   (which wraps: firebase emulators:exec --only firestore 'jest --testPathPattern=emulator')
// ─────────────────────────────────────────────────────────────────────────────

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import * as fs from 'fs'
import * as path from 'path'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'workfix-rules-test',
    firestore: {
      rules: fs.readFileSync(
        path.resolve(__dirname, '../../../../firestore.rules'),
        'utf8',
      ),
      host: 'localhost',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

afterEach(async () => {
  await testEnv.clearFirestore()
})

// ─────────────────────────────────────────────────────────────────────────────
// users collection
// ─────────────────────────────────────────────────────────────────────────────

describe('users collection', () => {
  test('unauthenticated cannot read user', async () => {
    const unauth = testEnv.unauthenticatedContext()
    await assertFails(
      unauth.firestore().collection('users').doc('user_001').get(),
    )
  })

  test('user can read own document', async () => {
    const alice = testEnv.authenticatedContext('alice', { role: 'customer' })
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('users').doc('alice').set({ displayName: 'Alice' })
    })
    await assertSucceeds(
      alice.firestore().collection('users').doc('alice').get(),
    )
  })

  test('user cannot read another user', async () => {
    const alice = testEnv.authenticatedContext('alice', { role: 'customer' })
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('users').doc('bob').set({ displayName: 'Bob' })
    })
    await assertFails(
      alice.firestore().collection('users').doc('bob').get(),
    )
  })

  test('admin can read any user', async () => {
    const admin = testEnv.authenticatedContext('admin_001', { role: 'admin' })
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('users').doc('alice').set({ displayName: 'Alice' })
    })
    await assertSucceeds(
      admin.firestore().collection('users').doc('alice').get(),
    )
  })

  test('user cannot change their own role', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('users').doc('alice').set({
        displayName: 'Alice', role: 'customer',
      })
    })
    const alice = testEnv.authenticatedContext('alice', { role: 'customer' })
    await assertFails(
      alice.firestore().collection('users').doc('alice').update({ role: 'admin' }),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// payments collection
// ─────────────────────────────────────────────────────────────────────────────

describe('payments collection — write protection', () => {
  test('customer cannot write to payments directly', async () => {
    const alice = testEnv.authenticatedContext('alice', { role: 'customer' })
    await assertFails(
      alice.firestore().collection('payments').doc('pay_001').set({
        orderId: 'ord_001', amount: 350,
      }),
    )
  })

  test('provider cannot write to payments directly', async () => {
    const provider = testEnv.authenticatedContext('prov_001', { role: 'provider' })
    await assertFails(
      provider.firestore().collection('payments').doc('pay_001').set({
        orderId: 'ord_001', amount: 350,
      }),
    )
  })

  test('customer can read own payment', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('payments').doc('pay_001').set({
        orderId: 'ord_001', customerId: 'alice', providerId: 'prov_001', amount: 350,
      })
    })
    const alice = testEnv.authenticatedContext('alice', { role: 'customer' })
    await assertSucceeds(
      alice.firestore().collection('payments').doc('pay_001').get(),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// orders collection
// ─────────────────────────────────────────────────────────────────────────────

describe('orders collection', () => {
  test('customer can create order', async () => {
    const alice = testEnv.authenticatedContext('alice', { role: 'customer' })
    await assertSucceeds(
      alice.firestore().collection('orders').add({
        customerId: 'alice',
        status:     'pending',
        createdAt:  new Date(),
      }),
    )
  })

  test('provider cannot create order', async () => {
    const provider = testEnv.authenticatedContext('prov_001', { role: 'provider' })
    await assertFails(
      provider.firestore().collection('orders').add({
        customerId: 'alice',
        status:     'pending',
      }),
    )
  })

  test('order cannot be deleted by anyone', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('orders').doc('ord_001').set({
        customerId: 'alice', status: 'closed',
      })
    })
    const admin = testEnv.authenticatedContext('admin_001', { role: 'admin' })
    await assertFails(
      admin.firestore().collection('orders').doc('ord_001').delete(),
    )
  })

  test('third party cannot read order', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('orders').doc('ord_001').set({
        customerId: 'alice', providerId: 'prov_001', status: 'confirmed',
      })
    })
    const stranger = testEnv.authenticatedContext('charlie', { role: 'customer' })
    await assertFails(
      stranger.firestore().collection('orders').doc('ord_001').get(),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// providerProfiles collection
// ─────────────────────────────────────────────────────────────────────────────

describe('providerProfiles collection', () => {
  test('anyone authenticated can read provider profile', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('providerProfiles').doc('prov_001').set({
        type: 'individual', kycStatus: 'approved',
      })
    })
    const alice = testEnv.authenticatedContext('alice', { role: 'customer' })
    await assertSucceeds(
      alice.firestore().collection('providerProfiles').doc('prov_001').get(),
    )
  })

  test('provider cannot change own kycStatus', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('providerProfiles').doc('prov_001').set({
        type: 'individual', kycStatus: 'pending',
      })
    })
    const provider = testEnv.authenticatedContext('prov_001', { role: 'provider' })
    await assertFails(
      provider.firestore().collection('providerProfiles').doc('prov_001').update({
        kycStatus: 'approved',
      }),
    )
  })

  test('admin can change kycStatus', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('providerProfiles').doc('prov_001').set({
        type: 'individual', kycStatus: 'pending',
      })
    })
    const admin = testEnv.authenticatedContext('admin_001', { role: 'admin' })
    await assertSucceeds(
      admin.firestore().collection('providerProfiles').doc('prov_001').update({
        kycStatus: 'approved',
      }),
    )
  })
})
