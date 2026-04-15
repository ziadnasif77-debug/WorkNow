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
} from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
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

// ─────────────────────────────────────────────────────────────────────────────
// reviews collection — all client writes must be impossible
// ─────────────────────────────────────────────────────────────────────────────

describe('reviews collection — client write protection', () => {
  test('authenticated customer cannot directly create a review', async () => {
    const alice = testEnv.authenticatedContext('alice', { role: 'customer' })
    await assertFails(
      alice.firestore().collection('reviews').doc('rev_001').set({
        orderId: 'ord_001', reviewerId: 'alice', rating: 5,
      }),
    )
  })

  test('authenticated provider cannot directly create a review', async () => {
    const provider = testEnv.authenticatedContext('prov_001', { role: 'provider' })
    await assertFails(
      provider.firestore().collection('reviews').doc('rev_001').set({
        orderId: 'ord_001', reviewerId: 'prov_001', rating: 4,
      }),
    )
  })

  test('unauthenticated user cannot create a review', async () => {
    const unauth = testEnv.unauthenticatedContext()
    await assertFails(
      unauth.firestore().collection('reviews').doc('rev_001').set({
        orderId: 'ord_001', reviewerId: 'anon', rating: 3,
      }),
    )
  })

  test('admin cannot directly create a review via client SDK', async () => {
    const admin = testEnv.authenticatedContext('admin_001', { role: 'admin' })
    await assertFails(
      admin.firestore().collection('reviews').doc('rev_001').set({
        orderId: 'ord_001', reviewerId: 'admin_001', rating: 5,
      }),
    )
  })

  test('authenticated customer cannot update an existing review', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('reviews').doc('rev_001').set({
        orderId: 'ord_001', reviewerId: 'alice', rating: 5,
      })
    })
    const alice = testEnv.authenticatedContext('alice', { role: 'customer' })
    await assertFails(
      alice.firestore().collection('reviews').doc('rev_001').update({ rating: 1 }),
    )
  })

  test('admin cannot delete a review via client SDK', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('reviews').doc('rev_001').set({
        orderId: 'ord_001', reviewerId: 'alice', rating: 5,
      })
    })
    const admin = testEnv.authenticatedContext('admin_001', { role: 'admin' })
    await assertFails(
      admin.firestore().collection('reviews').doc('rev_001').delete(),
    )
  })

  test('authenticated user can read reviews', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('reviews').doc('rev_001').set({
        orderId: 'ord_001', reviewerId: 'alice', rating: 5,
      })
    })
    const alice = testEnv.authenticatedContext('alice', { role: 'customer' })
    await assertSucceeds(
      alice.firestore().collection('reviews').doc('rev_001').get(),
    )
  })

  test('unauthenticated user cannot read reviews', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('reviews').doc('rev_001').set({
        orderId: 'ord_001', reviewerId: 'alice', rating: 5,
      })
    })
    const unauth = testEnv.unauthenticatedContext()
    await assertFails(
      unauth.firestore().collection('reviews').doc('rev_001').get(),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// providerProfiles — protected field injection on create
// ─────────────────────────────────────────────────────────────────────────────

describe('providerProfiles — protected field injection on create', () => {
  test('provider cannot inject kycStatus on create', async () => {
    const provider = testEnv.authenticatedContext('prov_new', { role: 'provider' })
    await assertFails(
      provider.firestore().collection('providerProfiles').doc('prov_new').set({
        name: 'New Provider', kycStatus: 'approved', createdAt: new Date(),
      }),
    )
  })

  test('provider cannot inject avgRating on create', async () => {
    const provider = testEnv.authenticatedContext('prov_new', { role: 'provider' })
    await assertFails(
      provider.firestore().collection('providerProfiles').doc('prov_new').set({
        name: 'New Provider', avgRating: 5.0, createdAt: new Date(),
      }),
    )
  })

  test('provider cannot inject totalReviews on create', async () => {
    const provider = testEnv.authenticatedContext('prov_new', { role: 'provider' })
    await assertFails(
      provider.firestore().collection('providerProfiles').doc('prov_new').set({
        name: 'New Provider', totalReviews: 999, createdAt: new Date(),
      }),
    )
  })

  test('provider cannot inject isVerified on create', async () => {
    const provider = testEnv.authenticatedContext('prov_new', { role: 'provider' })
    await assertFails(
      provider.firestore().collection('providerProfiles').doc('prov_new').set({
        name: 'New Provider', isVerified: true, createdAt: new Date(),
      }),
    )
  })

  test('provider cannot inject role on create', async () => {
    const provider = testEnv.authenticatedContext('prov_new', { role: 'provider' })
    await assertFails(
      provider.firestore().collection('providerProfiles').doc('prov_new').set({
        name: 'New Provider', role: 'admin', createdAt: new Date(),
      }),
    )
  })

  test('provider cannot include extra fields beyond the allowlist on create', async () => {
    const provider = testEnv.authenticatedContext('prov_new', { role: 'provider' })
    await assertFails(
      provider.firestore().collection('providerProfiles').doc('prov_new').set({
        name: 'New Provider', bio: 'Plumber', createdAt: new Date(), arbitraryField: 'injected',
      }),
    )
  })

  test('provider can create profile with only allowed fields', async () => {
    const provider = testEnv.authenticatedContext('prov_new', { role: 'provider' })
    await assertSucceeds(
      provider.firestore().collection('providerProfiles').doc('prov_new').set({
        name: 'New Provider', bio: 'Professional plumber', createdAt: new Date(),
      }),
    )
  })

  test('provider cannot create profile for a different provider ID', async () => {
    const provider = testEnv.authenticatedContext('prov_new', { role: 'provider' })
    await assertFails(
      provider.firestore().collection('providerProfiles').doc('prov_other').set({
        name: 'Impersonated Provider', createdAt: new Date(),
      }),
    )
  })

  test('customer cannot create a provider profile', async () => {
    const customer = testEnv.authenticatedContext('alice', { role: 'customer' })
    await assertFails(
      customer.firestore().collection('providerProfiles').doc('alice').set({
        name: 'Alice as Provider', createdAt: new Date(),
      }),
    )
  })
})
