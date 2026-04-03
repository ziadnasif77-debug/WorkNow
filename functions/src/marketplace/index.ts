// ─────────────────────────────────────────────────────────────────────────────
// Marketplace Functions — Geo search + Provider profiles
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import { callable, requireAuth, validate, db, serverTimestamp, appError } from '../_shared/helpers'
import { getSearchRanges, haversineKm } from '../_shared/search'
import { encodeGeohash } from '@workfix/utils'
import { GEO_PRECISION, PAGE_SIZE } from '@workfix/config'
import type { ProviderProfile } from '@workfix/types'

const searchProvidersSchema = z.object({
  lat:        z.number().min(-90).max(90),
  lng:        z.number().min(-180).max(180),
  radiusKm:   z.number().positive().max(100).default(20),
  categoryId: z.string().optional(),
  query:      z.string().max(100).optional(),
  minRating:  z.number().min(0).max(5).optional(),
  sortBy:     z.enum(['distance', 'rating', 'price']).default('distance'),
  page:       z.number().int().min(0).default(0),
  limit:      z.number().int().min(1).max(50).default(PAGE_SIZE),
})

export const searchProviders = callable(async (data, context) => {
  requireAuth(context)
  const input = validate(searchProvidersSchema, data)

  const center = { latitude: input.lat, longitude: input.lng }
  const ranges  = getSearchRanges(center, input.radiusKm)

  // Run parallel queries for all geohash ranges
  const querySnapshots = await Promise.all(
    ranges.map(({ lower, upper }) => {
      let q = db.collection('providerProfiles')
        .where('isActive', '==', true)
        .where('geohash', '>=', lower)
        .where('geohash', '<=', upper)

      if (input.categoryId) {
        q = q.where('categoryIds', 'array-contains', input.categoryId)
      }

      return q.limit(50).get()
    }),
  )

  // Deduplicate results (a provider might appear in overlapping ranges)
  const seen = new Map<string, ProviderProfile & { distanceKm: number }>()

  for (const snap of querySnapshots) {
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue
      const profile = doc.data() as ProviderProfile
      const km      = haversineKm(center, profile.location)
      if (km > input.radiusKm) continue
      if (input.minRating && profile.avgRating < input.minRating) continue
      seen.set(doc.id, { ...profile, id: doc.id, distanceKm: km })
    }
  }

  let results = Array.from(seen.values())

  // Sort
  if (input.sortBy === 'distance') {
    results.sort((a, b) => a.distanceKm - b.distanceKm)
  } else if (input.sortBy === 'rating') {
    results.sort((a, b) => b.avgRating - a.avgRating)
  }

  // Boost: providers with active boost come first
  const now = new Date()
  results.sort((a, b) => {
    const aBoost = a.boostExpiresAt && (a.boostExpiresAt as unknown as Date) > now ? 1 : 0
    const bBoost = b.boostExpiresAt && (b.boostExpiresAt as unknown as Date) > now ? 1 : 0
    return bBoost - aBoost
  })

  // Pagination
  const start = input.page * input.limit
  const page  = results.slice(start, start + input.limit)

  return {
    ok:      true,
    providers: page,
    total:   results.length,
    hasMore: start + input.limit < results.length,
  }
})

export const getProviderProfile = callable(async (data, context) => {
  requireAuth(context)
  const input = validate(z.object({ providerId: z.string().min(1) }), data)

  const [profileDoc, userDoc, reviewsSnap] = await Promise.all([
    db.collection('providerProfiles').doc(input.providerId).get(),
    db.collection('users').doc(input.providerId).get(),
    db.collection('reviews')
      .where('targetId', '==', input.providerId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get(),
  ])

  if (!profileDoc.exists) appError('GEN_004', 'Provider not found', 'not-found')

  return {
    ok:      true,
    profile: { ...profileDoc.data(), id: profileDoc.id },
    user:    { displayName: userDoc.data()?.['displayName'], avatarUrl: userDoc.data()?.['avatarUrl'] },
    reviews: reviewsSnap.docs.map(d => ({ ...d.data(), id: d.id })),
  }
})

export const updateProfile = callable(async (data, context) => {
  const { uid } = requireAuth(context, ['provider'])

  const schema = z.object({
    bio:          z.string().max(500).optional(),
    businessName: z.string().max(100).optional(),
    lat:          z.number().optional(),
    lng:          z.number().optional(),
    city:         z.string().max(60).optional(),
    workingHours: z.record(z.object({
      open:  z.string(),
      close: z.string(),
      isOff: z.boolean(),
    })).optional(),
  })

  const input = validate(schema, data)
  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() }

  if (input.bio)          updates['bio'] = input.bio
  if (input.businessName) updates['businessName'] = input.businessName
  if (input.city)         updates['city'] = input.city
  if (input.workingHours) updates['workingHours'] = input.workingHours

  if (input.lat !== undefined && input.lng !== undefined) {
    const location = { latitude: input.lat, longitude: input.lng }
    updates['location'] = location
    updates['geohash']  = encodeGeohash(location, GEO_PRECISION)
  }

  await db.collection('providerProfiles').doc(uid).update(updates)
  return { ok: true }
})
