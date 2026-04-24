// ─────────────────────────────────────────────────────────────────────────────
// Marketplace Functions — Geo search + Provider profiles
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import { callable, requireAuth, validate, db, serverTimestamp, appError } from '../_shared/helpers'
import { rateLimit } from '../_shared/ratelimit'
import { getSearchRanges, haversineKm } from '../_shared/search'
import { encodeGeohash } from '@workfix/utils'
import { GEO_PRECISION, PAGE_SIZE, RANK_WEIGHTS, NEW_PROVIDER_BOOST } from '@workfix/config'
import type { ProviderProfile } from '@workfix/types'

// ── Ranking Engine ────────────────────────────────────────────────────────────

type RankedProvider = ProviderProfile & { distanceKm: number; rankScore: number }

function computeRankScore(
  profile: ProviderProfile & { distanceKm: number },
  radiusKm: number,
  now: Date,
): number {
  const normalizedDist   = Math.min(profile.distanceKm / radiusKm, 1)
  const ratingScore      = (profile.avgRating ?? 0) / 5
  const repScore         = ((profile.reputationScore ?? profile.avgRating) ?? 0) / 5
  const completedOrders  = profile.totalCompletedOrders ?? 0
  const completionNorm   = Math.min(completedOrders / 30, 1)
  const isBoostActive    = !!(
    profile.boostExpiresAt && (profile.boostExpiresAt as unknown as Date) > now
  )
  const isNewProvider    = completedOrders < 10

  return (
    RANK_WEIGHTS.distance   * (1 - normalizedDist) +
    RANK_WEIGHTS.rating     * ratingScore +
    RANK_WEIGHTS.experience * completionNorm +
    RANK_WEIGHTS.reputation * repScore +
    (isBoostActive ? 0.15 : 0) +     // paid boost
    (isNewProvider ? NEW_PROVIDER_BOOST : 0)  // cold-start lift
  )
}

// ── searchProviders ───────────────────────────────────────────────────────────

const searchProvidersSchema = z.object({
  lat:        z.number().min(-90).max(90),
  lng:        z.number().min(-180).max(180),
  radiusKm:   z.number().positive().max(100).default(20),
  categoryId: z.string().optional(),
  query:      z.string().max(100).optional(),
  minRating:  z.number().min(0).max(5).optional(),
  sortBy:     z.enum(['distance', 'rating', 'price', 'rank']).default('rank'),
  page:       z.number().int().min(0).default(0),
  limit:      z.number().int().min(1).max(50).default(PAGE_SIZE),
})

async function fetchProviders(
  center: { latitude: number; longitude: number },
  radiusKm: number,
  categoryId: string | undefined,
  minRating: number | undefined,
): Promise<RankedProvider[]> {
  const ranges = getSearchRanges(center, radiusKm)
  const now    = new Date()

  const querySnapshots = await Promise.all(
    ranges.map(({ lower, upper }) => {
      let q = db.collection('providerProfiles')
        .where('isActive', '==', true)
        .where('kycStatus', '==', 'approved')
        .where('geohash', '>=', lower)
        .where('geohash', '<=', upper)

      if (categoryId) {
        q = q.where('categoryIds', 'array-contains', categoryId)
      }

      return q.limit(100).get()
    }),
  )

  const seen = new Map<string, RankedProvider>()

  for (const snap of querySnapshots) {
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue
      const profile = doc.data() as ProviderProfile
      const km      = haversineKm(center, profile.location)
      if (km > radiusKm) continue
      if (minRating && profile.avgRating < minRating) continue

      seen.set(doc.id, {
        ...profile,
        id: doc.id,
        distanceKm: km,
        rankScore: computeRankScore({ ...profile, distanceKm: km }, radiusKm, now),
      })
    }
  }

  return Array.from(seen.values())
}

export const searchProviders = callable(async (data, context) => {
  const { uid } = requireAuth(context)
  await rateLimit(uid, 'api')
  const input  = validate(searchProvidersSchema, data)
  const center = { latitude: input.lat, longitude: input.lng }
  const baseRadius = input.radiusKm ?? 20

  let results = await fetchProviders(center, baseRadius, input.categoryId, input.minRating)

  // Dynamic radius: if fewer than 3 results, expand by 1.5× (once)
  if (results.length < 3 && baseRadius < 100) {
    const expandedRadius = Math.min(baseRadius * 1.5, 100)
    results = await fetchProviders(center, expandedRadius, input.categoryId, input.minRating)
    // Re-score with expanded radius for fair comparison
    const now = new Date()
    results = results.map(p => ({
      ...p,
      rankScore: computeRankScore(p, expandedRadius, now),
    }))
  }

  // Sort
  switch (input.sortBy) {
    case 'distance': results.sort((a, b) => a.distanceKm - b.distanceKm); break
    case 'rating':   results.sort((a, b) => b.avgRating - a.avgRating); break
    case 'rank':
    default:         results.sort((a, b) => b.rankScore - a.rankScore); break
  }

  // Pagination
  const pageNum  = input.page ?? 0
  const limitNum = input.limit ?? PAGE_SIZE
  const start    = pageNum * limitNum
  const page     = results.slice(start, start + limitNum)

  return {
    ok:        true,
    providers: page,
    total:     results.length,
    hasMore:   start + limitNum < results.length,
  }
})

// ── getProviderProfile ────────────────────────────────────────────────────────

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

// ── updateProfile ─────────────────────────────────────────────────────────────

export const updateProfile = callable(async (data, context) => {
  const { uid } = requireAuth(context, ['provider'])
  await rateLimit(uid, 'api')

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

  const input   = validate(schema, data)
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
