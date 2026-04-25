// ─────────────────────────────────────────────────────────────────────────────
// Marketplace Functions — Geo search + Provider profiles
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import { callable, requireAuth, validate, db, serverTimestamp, appError } from '../_shared/helpers'
import { rateLimit } from '../_shared/ratelimit'
import { getSearchRanges, haversineKm } from '../_shared/search'
import { encodeGeohash } from '@workfix/utils'
import { GEO_PRECISION, PAGE_SIZE } from '@workfix/config'
import type { ProviderProfile } from '@workfix/types'

// ── Ranking Engine ────────────────────────────────────────────────────────────

type RankedProvider = ProviderProfile & { distanceKm: number; rankScore: number }

// Independent signal weights (normal / radius-expanded)
const W_NORMAL   = { proximity: 0.30, trust: 0.25, performance: 0.20, responsiveness: 0.15, activity: 0.10 }
const W_EXPANDED = { proximity: 0.20, trust: 0.28, performance: 0.22, responsiveness: 0.18, activity: 0.12 }

// Bayesian average: pulls low-count providers toward the global mean (4.0)
// Prevents a 5⭐ provider with 2 reviews from ranking above a 4.7⭐ with 200 reviews
function bayesianRating(rating: number, reviewCount: number): number {
  const C = 10    // prior weight — needs 10+ reviews before rating is "trusted"
  const m = 4.0   // global mean prior
  return (C * m + reviewCount * rating) / (C + reviewCount)
}

function computeRankScore(
  profile: ProviderProfile & { distanceKm: number },
  radiusKm: number,
  now: Date,
  radiusExpanded: boolean,
): number {
  const W = radiusExpanded ? W_EXPANDED : W_NORMAL

  const completed       = profile.totalCompletedOrders ?? 0
  const cancellations   = (profile as unknown as Record<string, unknown>)['cancellationsAsProvider'] as number ?? 0
  const completionRate  = completed / Math.max(completed + cancellations, 1)

  // Five independent, non-correlated signals
  const proximityScore     = 1 - Math.min(profile.distanceKm / radiusKm, 1)
  const trustScore         = bayesianRating(profile.avgRating ?? 0, profile.totalReviews ?? 0) / 5
  const performanceScore   = completionRate
  const responsivenessScore = 0.5   // placeholder until avgResponseTimeMs is tracked
  const activityScore      = Math.min(completed / 30, 1)

  const baseScore =
    W.proximity     * proximityScore +
    W.trust         * trustScore +
    W.performance   * performanceScore +
    W.responsiveness * responsivenessScore +
    W.activity      * activityScore

  // Boost and cold-start as multipliers — they amplify base score, not bypass it
  const isBoostActive  = !!(profile.boostExpiresAt && (profile.boostExpiresAt as unknown as Date) > now)
  const isNewProvider  = completed < 10

  return baseScore * (isBoostActive ? 1.20 : 1.0) * (isNewProvider ? 1.10 : 1.0)
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

const MAX_SEARCH_RADIUS_KM = 25  // hard cap: beyond this UX degrades

async function fetchProviders(
  center: { latitude: number; longitude: number },
  radiusKm: number,
  categoryId: string | undefined,
  minRating: number | undefined,
  radiusExpanded: boolean,
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
        rankScore: computeRankScore({ ...profile, distanceKm: km }, radiusKm, now, radiusExpanded),
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

  let radiusExpanded = false
  let results = await fetchProviders(center, baseRadius, input.categoryId, input.minRating, false)

  // Dynamic radius: if fewer than 3 results, expand once — capped at MAX_SEARCH_RADIUS_KM
  if (results.length < 3 && baseRadius < MAX_SEARCH_RADIUS_KM) {
    const expandedRadius = Math.min(baseRadius * 1.5, MAX_SEARCH_RADIUS_KM)
    radiusExpanded = true
    results = await fetchProviders(center, expandedRadius, input.categoryId, input.minRating, true)
  }

  void radiusExpanded  // consumed via closure in fetchProviders

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
