// ─────────────────────────────────────────────────────────────────────────────
// Enhanced Search — multi-neighbor geohash queries
// Why not Algolia? Firestore Geohash is free and works for <50k providers
// Algolia migration path: replace executeGeoQuery() when needed
// ─────────────────────────────────────────────────────────────────────────────

import * as ngeohash from 'ngeohash'
import type { GeoPoint } from '@workfix/types'

/**
 * Generate all geohash queries needed to cover a circular radius.
 * Uses the center geohash + 8 neighbors to avoid boundary misses.
 *
 * Returns array of {lower, upper} ranges for Firestore queries.
 */
export function getSearchRanges(
  center: GeoPoint,
  radiusKm: number,
): Array<{ lower: string; upper: string }> {
  // Precision 5 covers ~5km × 5km cells — good for city-level search
  // Precision 6 covers ~1.2km × 0.6km — good for neighbourhood search
  const precision = radiusKm <= 2 ? 6 : radiusKm <= 10 ? 5 : 4

  const centerHash = ngeohash.encode(center.latitude, center.longitude, precision)
  const neighbors  = ngeohash.neighbors(centerHash)

  // All 9 cells: center + 8 neighbors
  const allHashes = [centerHash, ...Object.values(neighbors)]
  const sorted    = [...new Set(allHashes)].sort()

  // Merge consecutive ranges to reduce query count
  const ranges: Array<{ lower: string; upper: string }> = []
  let currentRange: { lower: string; upper: string } | null = null

  for (const hash of sorted) {
    if (!currentRange) {
      currentRange = { lower: hash, upper: hash + '~' }
    } else if (hash <= currentRange.upper) {
      // Extend current range
      currentRange.upper = hash + '~'
    } else {
      ranges.push(currentRange)
      currentRange = { lower: hash, upper: hash + '~' }
    }
  }
  if (currentRange) ranges.push(currentRange)

  return ranges
}

/**
 * Calculate approximate geohash precision for a given radius
 */
export function getPrecisionForRadius(radiusKm: number): number {
  if (radiusKm <= 0.1) return 8   // ~19m
  if (radiusKm <= 0.5) return 7   // ~76m
  if (radiusKm <= 2)   return 6   // ~1.2km
  if (radiusKm <= 10)  return 5   // ~4.9km
  if (radiusKm <= 50)  return 4   // ~39km
  return 3                         // ~156km
}

/**
 * Haversine distance — same as utils but available server-side without import
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R    = 6371
  const dLat = (b.latitude  - a.latitude)  * Math.PI / 180
  const dLon = (b.longitude - a.longitude) * Math.PI / 180
  const sin1 = Math.sin(dLat / 2)
  const sin2 = Math.sin(dLon / 2)
  const chord = sin1 * sin1 +
    Math.cos(a.latitude * Math.PI / 180) *
    Math.cos(b.latitude * Math.PI / 180) *
    sin2 * sin2
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord))
}
