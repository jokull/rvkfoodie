/**
 * Entity models, checked against the Drizzle row types, plus the one-off
 * aggregate. The Venue entity is the payoff: every feed row is the SAME
 * entity, so a mutation that returns a Venue patches every cached occurrence
 * in place. Nullable columns use wire.nullable to match the row type.
 */
import { defineModel, wire, type InputOf, type ModelValue } from 'result-rpc'
import type { auditLog, hotels, venueLifecycleEvents, venues } from './schema.js'

export const Venue = defineModel('venue', {
  key: 'id',
  shape: {
    id: wire.string,
    name: wire.string,
    category: wire.string,
    categorySecondary: wire.nullable(wire.string),
    status: wire.string,
    orderKey: wire.string,
    cuisine: wire.nullable(wire.string),
    priceLevel: wire.nullable(wire.integer({ min: 1, max: 4 })),
    tags: wire.array(wire.string),
    note: wire.nullable(wire.string),
    recommendedDishes: wire.array(wire.string),
    lastVerifiedAt: wire.nullable(wire.date),
    confidence: wire.number,
    source: wire.nullable(wire.string),
    address: wire.string,
    lat: wire.nullable(wire.number),
    lon: wire.nullable(wire.number),
    googlePlacesId: wire.nullable(wire.string),
    dineoutId: wire.nullable(wire.string),
    openingHours: wire.nullable(wire.string),
    photos: wire.array(wire.string),
  },
}).$satisfies<typeof venues.$inferSelect>()
export type VenueRow = ModelValue<typeof Venue>

export const LifecycleEvent = defineModel('lifecycle-event', {
  key: 'id',
  shape: {
    id: wire.string,
    venueId: wire.string,
    type: wire.string,
    startedAt: wire.date,
    endedAt: wire.nullable(wire.date),
    note: wire.nullable(wire.string),
  },
}).$satisfies<typeof venueLifecycleEvents.$inferSelect>()
export type LifecycleEventRow = ModelValue<typeof LifecycleEvent>

export const AuditEntry = defineModel('audit-entry', {
  key: 'id',
  shape: {
    id: wire.string,
    actor: wire.string,
    action: wire.string,
    entityType: wire.string,
    entityId: wire.string,
    before: wire.nullable(wire.string),
    after: wire.nullable(wire.string),
    at: wire.date,
  },
}).$satisfies<typeof auditLog.$inferSelect>()
export type AuditEntryRow = ModelValue<typeof AuditEntry>

export const Hotel = defineModel('hotel', {
  key: 'id',
  shape: {
    id: wire.string,
    name: wire.string,
    roomCount: wire.number,
    pipelineStage: wire.string,
  },
}).$satisfies<typeof hotels.$inferSelect>()
export type HotelRow = ModelValue<typeof Hotel>

/** One-off aggregate — no entity identity, kept fresh via `.affects()`. */
export const OverviewCodec = wire.object({
  venueCount: wire.number,
  liveVenueCount: wire.number,
  hotelCount: wire.number,
})
export type Overview = InputOf<typeof OverviewCodec>
