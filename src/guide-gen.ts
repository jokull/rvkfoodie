/**
 * The drafting engine — a PURE module (no D1, no workerd imports) so the
 * generator is unit-testable in plain node. The RPC handler does the DB I/O
 * and calls these functions.
 *
 * Algorithm (per the wayfinder map): the pool is the hotel's live venues
 * within the walking radius (status is the ONLY silent qualifier — see
 * guide/health decisions). Rounds iterate the template category order,
 * each round adding the closest remaining venue per category, until the
 * itinerary target is filled. Circuit breakers stop runaway cycling.
 */
import { generateKeyBetween } from 'fractional-indexing'
import { VENUE_CATEGORIES } from './schema.js'

/** Template section order — the fixed category sequence. */
export const CATEGORY_ORDER = [...VENUE_CATEGORIES]

/** Walking pace 5 km/h, straight-line ≈ 1/1.3 of walked path. */
const straightKm = (walkMinutes: number) => (walkMinutes * 5) / 60 / 1.3

export interface GeoPoint {
  lat: number | null
  lon: number | null
}

export const haversineKm = (a: GeoPoint, b: GeoPoint): number => {
  const R = 6371
  const dLat = ((b.lat! - a.lat!) * Math.PI) / 180
  const dLon = ((b.lon! - a.lon!) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat! * Math.PI) / 180) * Math.cos((b.lat! * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export interface DraftPoolVenue extends GeoPoint {
  id: string
  category: string
  confidence: number
}

export interface DraftInput {
  /** The hotel pin (may be null — nothing drafts without it). */
  hotel: GeoPoint
  /** Walk minutes, converted to straight-line km. */
  radiusMin: number
  /** Itinerary target. */
  targetCount: number
  /** Live, non-excluded, coords-bearing venues NOT already in the guide. */
  pool: DraftPoolVenue[]
  /** The current last orderKey in the guide (appends after it). */
  lastOrderKey: string | null
}

export interface DraftPick {
  venueId: string
  orderKey: string
}

export function draftItinerary(input: DraftInput): DraftPick[] {
  if (input.hotel.lat === null || input.hotel.lon === null) return []
  const radiusKm = straightKm(input.radiusMin)
  if (radiusKm <= 0) return []

  // Closest-first, confidence as tiebreak — per category.
  const queues = new Map<string, DraftPoolVenue[]>()
  for (const venue of input.pool) {
    if (venue.lat === null || venue.lon === null) continue
    if (haversineKm(input.hotel, venue) > radiusKm) continue
    const q = queues.get(venue.category) ?? []
    q.push(venue)
    queues.set(venue.category, q)
  }
  for (const q of queues.values()) {
    q.sort((x, y) => {
      const dx = haversineKm(input.hotel, x)
      const dy = haversineKm(input.hotel, y)
      return dx !== dy ? dx - dy : y.confidence - x.confidence
    })
  }

  // Round-robin cycles over the template category order. Circuit breakers:
  // stop when a full round adds nothing, when the target is reached, or at
  // a hard guard (target + one full pass) — no runaway cycling.
  const picks: DraftPoolVenue[] = []
  let cursor = input.lastOrderKey
  let rounds = 0
  const maxRounds = input.targetCount + CATEGORY_ORDER.length
  while (picks.length < input.targetCount && rounds < maxRounds) {
    let addedThisRound = false
    for (const category of CATEGORY_ORDER) {
      const next = queues.get(category)?.shift()
      if (!next) continue
      picks.push(next)
      addedThisRound = true
      if (picks.length >= input.targetCount) break
    }
    if (!addedThisRound) break
    rounds++
  }

  return picks.map((venue) => {
    cursor = generateKeyBetween(cursor, null)
    return { venueId: venue.id, orderKey: cursor }
  })
}
