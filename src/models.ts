/**
 * Entity models, checked against the Drizzle row types, plus the one-off
 * aggregate. The Venue entity is the payoff: every feed row is the SAME
 * entity, so a mutation that returns a Venue patches every cached occurrence
 * in place. Nullable columns use wire.nullable to match the row type.
 */
import { defineModel, wire, type InputOf, type ModelValue } from 'result-rpc'
import type {
  StoredAuditEntry,
  StoredBusiness,
  StoredContact,
  StoredDeal,
  StoredGuide,
  StoredGuideVenue,
  StoredHotel,
  StoredLifecycleEvent,
  StoredVenue,
} from './schema.js'
import { VENUE_AWARD_TYPES } from './schema.js'

const enumOf = <const TValues extends readonly [string, ...string[]]>(values: TValues) =>
  wire.union(values.map((v) => wire.literal(v)))

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
    website: wire.nullable(wire.string),
    phone: wire.nullable(wire.string),
    openingHours: wire.nullable(wire.string),
    photos: wire.array(wire.string),
    createdAt: wire.date,
  },
}).$satisfies<StoredVenue>()
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
}).$satisfies<StoredLifecycleEvent>()
export type LifecycleEventRow = ModelValue<typeof LifecycleEvent>

export const VenueAward = defineModel('venue-award', {
  key: 'id',
  shape: {
    id: wire.string,
    venueId: wire.string,
    awardType: enumOf(VENUE_AWARD_TYPES),
    title: wire.string,
    url: wire.nullable(wire.string),
    createdAt: wire.date,
  },
})
export type VenueAwardRow = ModelValue<typeof VenueAward>

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
}).$satisfies<StoredAuditEntry>()
export type AuditEntryRow = ModelValue<typeof AuditEntry>

export const Hotel = defineModel('hotel', {
  key: 'id',
  shape: {
    id: wire.string,
    businessId: wire.nullable(wire.string),
    name: wire.string,
    address: wire.nullable(wire.string),
    lat: wire.nullable(wire.number),
    lon: wire.nullable(wire.number),
    roomCount: wire.number,
    website: wire.nullable(wire.string),
  },
}).$satisfies<StoredHotel>()
export type HotelRow = ModelValue<typeof Hotel>

export const Business = defineModel('business', {
  key: 'id',
  shape: {
    id: wire.string,
    name: wire.string,
    website: wire.nullable(wire.string),
    industry: wire.nullable(wire.string),
    notes: wire.nullable(wire.string),
  },
}).$satisfies<StoredBusiness>()
export type BusinessRow = ModelValue<typeof Business>

export const Contact = defineModel('contact', {
  key: 'id',
  shape: {
    id: wire.string,
    businessId: wire.string,
    hotelId: wire.nullable(wire.string),
    firstName: wire.nullable(wire.string),
    lastName: wire.nullable(wire.string),
    email: wire.nullable(wire.string),
    phone: wire.nullable(wire.string),
    title: wire.nullable(wire.string),
    isDecisionMaker: wire.boolean,
  },
}).$satisfies<StoredContact>()
export type ContactRow = ModelValue<typeof Contact>

export const Deal = defineModel('deal', {
  key: 'id',
  shape: {
    id: wire.string,
    businessId: wire.string,
    name: wire.string,
    stage: wire.string,
    pricePerRoom: wire.nullable(wire.integer({ min: 0 })),
    annualValue: wire.nullable(wire.integer({ min: 0 })),
    startDate: wire.nullable(wire.date),
    renewalDate: wire.nullable(wire.date),
    notes: wire.nullable(wire.string),
  },
}).$satisfies<StoredDeal>()
export type DealRow = ModelValue<typeof Deal>

/** One per hotel (V1). */
export const Guide = defineModel('guide', {
  key: 'id',
  shape: {
    id: wire.string,
    hotelId: wire.string,
    slug: wire.string,
    status: wire.string,
    radiusMin: wire.integer(),
    targetCount: wire.integer(),
    generatedAt: wire.nullable(wire.date),
  },
}).$satisfies<StoredGuide>()
export type GuideRow = ModelValue<typeof Guide>

/** A snapshot row: pending (generated, unapproved), live, or removed. */
export const GuideVenue = defineModel('guide-venue', {
  key: 'id',
  shape: {
    id: wire.string,
    guideId: wire.string,
    venueId: wire.string,
    status: wire.string,
    orderKey: wire.string,
    overrideText: wire.nullable(wire.string),
    pinned: wire.boolean,
  },
}).$satisfies<StoredGuideVenue>()
export type GuideVenueRow = ModelValue<typeof GuideVenue>

/** The public guide view — guide + live venue rows with overrides. */
export const GuideVenueViewCodec = wire.object({
  id: wire.string,
  venueId: wire.string,
  orderKey: wire.string,
  overrideText: wire.nullable(wire.string),
  pinned: wire.boolean,
  venue: Venue.pick(
    'id',
    'name',
    'category',
    'categorySecondary',
    'address',
    'openingHours',
    'note',
    'recommendedDishes',
    'dineoutId',
    'website',
    'phone',
    'lat',
    'lon',
    'confidence',
    'photos',
  ),
})

export const GuideViewCodec = wire.object({
  guide: Guide.all('the guide is public'),
  venueRows: wire.array(GuideVenueViewCodec),
})
export type GuideView = InputOf<typeof GuideViewCodec>

/** The builder's snapshot row — every status, with the venue attached. */
export const GuideBuilderRowCodec = wire.object({
  id: wire.string,
  venueId: wire.string,
  status: wire.string,
  orderKey: wire.string,
  overrideText: wire.nullable(wire.string),
  pinned: wire.boolean,
  venue: Venue.pick('id', 'name', 'category', 'address', 'confidence', 'photos'),
})
export type GuideBuilderRow = InputOf<typeof GuideBuilderRowCodec>

export const GuideBuilderCodec = wire.object({
  guide: Guide.all('guide metadata is staff-visible'),
  rows: wire.array(GuideBuilderRowCodec),
  excludes: wire.array(wire.object({ venueId: wire.string, name: wire.string })),
})
export type GuideBuilder = InputOf<typeof GuideBuilderCodec>
export const OverviewCodec = wire.object({
  venueCount: wire.number,
  liveVenueCount: wire.number,
  hotelCount: wire.number,
})
export type Overview = InputOf<typeof OverviewCodec>

/** One guide's digest line — added/removed are venue NAMES (hotel-facing). */
export const DigestEntry = wire.object({
  guideId: wire.string,
  slug: wire.string,
  added: wire.array(wire.string),
  removed: wire.array(wire.string),
  /** Recipients that got the email (empty when no contacts are on file). */
  emailed: wire.array(wire.string),
  /** True when the baseline was snapshotted with nothing sent (first run). */
  skipped: wire.boolean,
})

export const DigestResult = wire.array(DigestEntry)
