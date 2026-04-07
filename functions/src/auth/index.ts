// ─────────────────────────────────────────────────────────────────────────────
// Auth Functions
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import { callable, requireAuth, validate, db, auth, serverTimestamp, appError } from '../_shared/helpers'
import { rateLimit } from '../_shared/ratelimit'
import type { User, ProviderProfile } from '@workfix/types'
import { encodeGeohash } from '@workfix/utils'

// ── completeProfile ───────────────────────────────────────────────────────────

const completeProfileSchema = z.object({
  displayName: z.string().min(2).max(60),
  phone: z.string().optional(),
  preferredLang: z.enum(['ar', 'en', 'no', 'sv']).default('ar'),
})

export const completeProfile = callable(async (data, context) => {
  const { uid } = requireAuth(context)
  const input = validate(completeProfileSchema, data)

  const userRef = db.collection('users').doc(uid)
  const existing = await userRef.get()

  if (!existing.exists) {
    // First-time profile creation
    const user: Omit<User, 'id'> = {
      displayName: input.displayName,
      ...(input.phone !== undefined && { phone: input.phone }),
      role: 'customer',       // default role; changed by setProviderType
      isVerified: false,
      isActive: true,
      preferredLang: input.preferredLang ?? 'ar',
      createdAt: serverTimestamp() as unknown as import('@workfix/types').Timestamp,
      updatedAt: serverTimestamp() as unknown as import('@workfix/types').Timestamp,
    }
    await userRef.set(user)
  } else {
    await userRef.update({
      displayName: input.displayName,
      ...(input.phone && { phone: input.phone }),
      preferredLang: input.preferredLang ?? 'ar',
      updatedAt: serverTimestamp(),
    })
  }

  return { ok: true }
})

// ── setProviderType ───────────────────────────────────────────────────────────

const setProviderTypeSchema = z.object({
  type: z.enum(['individual', 'company']),
  businessName: z.string().min(2).max(100).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  city: z.string().min(1).max(60),
  country: z.string().length(2), // ISO 3166-1 alpha-2
})

export const setProviderType = callable(async (data, context) => {
  const { uid } = requireAuth(context)
  const input = validate(setProviderTypeSchema, data)

  if (input.type === 'company' && !input.businessName) {
    appError('VAL_002', 'businessName is required for company accounts')
  }

  // Guard: only customers (role = 'customer') may upgrade to provider.
  // Allowing an existing provider to call this would reset kycStatus → 'pending',
  // letting a suspended/rejected provider bypass admin enforcement.
  const userSnap = await db.collection('users').doc(uid).get()
  const currentRole = userSnap.data()?.['role'] as string | undefined
  if (currentRole === 'provider') {
    appError('AUTH_003', 'Account is already a provider. Use your existing provider profile.', 'permission-denied')
  }

  const location = { latitude: input.lat, longitude: input.lng }
  const geohash = encodeGeohash(location)

  // Update user role to provider
  await db.collection('users').doc(uid).update({
    role: 'provider',
    updatedAt: serverTimestamp(),
  })

  // Set Custom Claims
  await auth.setCustomUserClaims(uid, {
    role: 'provider',
    providerType: input.type,
    kycStatus: 'pending',
    verified: false,
  })

  // Create provider profile
  const profile: Omit<ProviderProfile, 'id'> = {
    type: input.type,
    ...(input.businessName !== undefined && { businessName: input.businessName }),
    location,
    geohash,
    city: input.city,
    country: input.country,
    serviceIds: [],
    categoryIds: [],
    avgRating: 0,
    totalReviews: 0,
    totalCompletedOrders: 0,
    kycStatus: 'pending',
    kycDocumentUrls: [],
    subscriptionTier: 'free',
    isActive: false,  // inactive until KYC approved
    createdAt: serverTimestamp() as unknown as import('@workfix/types').Timestamp,
    updatedAt: serverTimestamp() as unknown as import('@workfix/types').Timestamp,
  }

  await db.collection('providerProfiles').doc(uid).set(profile)

  return { ok: true, message: 'Provider profile created. Awaiting KYC approval.' }
})

// ── uploadKyc ─────────────────────────────────────────────────────────────────

const uploadKycSchema = z.object({
  documentUrls: z.array(z.string().url()).min(1).max(5),
})

export const uploadKyc = callable(async (data, context) => {
  const { uid, role } = requireAuth(context, ['provider'])
  await rateLimit(uid, 'kyc')

  if (role !== 'provider') {
    appError('AUTH_002', 'Only providers can upload KYC documents', 'permission-denied')
  }

  const input = validate(uploadKycSchema, data)

  await db.collection('providerProfiles').doc(uid).update({
    kycDocumentUrls: input.documentUrls,
    kycStatus: 'pending',
    updatedAt: serverTimestamp(),
  })

  // Notify admins (via a trigger or direct FCM — simplified here)
  await db.collection('adminTasks').add({
    type: 'kyc_review',
    providerId: uid,
    documentUrls: input.documentUrls,
    createdAt: serverTimestamp(),
  })

  return { ok: true, message: 'KYC documents submitted for review.' }
})
