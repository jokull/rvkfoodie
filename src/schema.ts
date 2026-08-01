/**
 * Drizzle schema for the platform database (D1).
 *
 * Identity: CUID2 (server-generated). Curated ordering: fractional-index
 * keys (`fractional-indexing`), client-computable, BINARY-safe under SQLite.
 * Timestamps: integer ms (mode: 'timestamp_ms'), surfaced as Date.
 * JSON list columns: text(... { mode: 'json' }) + $type (tags, dishes,
 * photos, audit snapshots). Text "enums" are type-level only — the app
 * layer owns the value sets (venue status, categories, lifecycle types,
 * pipeline stages).
 */
import { index, integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

export const VENUE_STATUS = ['draft', 'live', 'closed'] as const
export const VENUE_CATEGORIES = [
  'breakfast-brunch',
  'cafe',
  'bakery',
  'restaurant',
  'bar',
  'street-food',
  'sweet-treats',
] as const
export const LIFECYCLE_TYPES = ['closed', 'temporarily-closed', 'reopened'] as const
export const PIPELINE_STAGES = [
  'prospect',
  'contacted',
  'sample-sent',
  'proposal',
  'won',
  'lost',
] as const
export const GUIDE_STATUS = ['draft', 'live'] as const
export const GUIDE_VENUE_STATUS = ['pending', 'live', 'removed'] as const

/** The editorial database — one curated venue. */
export const venues = sqliteTable(
  'venues',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    /** Primary category (see VENUE_CATEGORIES); the guide template groups by it. */
    category: text('category').notNull(),
    /** Optional secondary category — card tag + drafting balance tiebreak. */
    categorySecondary: text('category_secondary'),
    /** draft | live | closed */
    status: text('status').notNull().default('draft'),
    /** Fractional-index key — curated order, client-computable. */
    orderKey: text('order_key').notNull(),
    cuisine: text('cuisine'),
    /** 1..4 */
    priceLevel: integer('price_level'),
    tags: text('tags', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    /** Canonical editorial copy — overridable per guide. */
    note: text('note'),
    recommendedDishes: text('recommended_dishes', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp_ms' }),
    /** 0..1 editorial confidence; lifecycle closure drops it to 0. */
    confidence: real('confidence').notNull().default(0),
    /** Where the recommendation came from (backfill | editorial | review …). */
    source: text('source'),
    address: text('address').notNull(),
    lat: real('lat'),
    lon: real('lon'),
    googlePlacesId: text('google_places_id'),
    /** Dineout booking id — "reserve a table" deep link. */
    dineoutId: text('dineout_id'),
    website: text('website'),
    phone: text('phone'),
    /** Free text, not structured. */
    openingHours: text('opening_hours'),
    /** R2 object keys, resolved to URLs at read time. */
    photos: text('photos', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index('venues_status_idx').on(t.status),
    index('venues_category_idx').on(t.category),
    index('venues_order_idx').on(t.orderKey),
  ],
)

/** Award types a venue can carry; drives editor's-pick markers on guides. */
export const VENUE_AWARD_TYPES = ['grapevine-best-of'] as const

/** Curated awards — one row per (venue, type). */
export const venueAwards = sqliteTable(
  'venue_awards',
  {
    id: text('id').primaryKey(),
    venueId: text('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    awardType: text('award_type', { enum: VENUE_AWARD_TYPES }).notNull(),
    title: text('title').notNull(),
    url: text('url'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [unique('venue_awards_venue_type').on(t.venueId, t.awardType)],
)

/** Venue lifecycle events — closures, temporary closures, reopenings. */
export const venueLifecycleEvents = sqliteTable(
  'venue_lifecycle_events',
  {
    id: text('id').primaryKey(),
    venueId: text('venue_id').notNull(),
    /** closed | temporarily-closed | reopened */
    type: text('type').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
    note: text('note'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index('vle_venue_idx').on(t.venueId),
    index('vle_type_idx').on(t.type),
  ],
)

/** Generic action log — every mutation writes an entry. */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    /** Editor identity (email) or 'system' — pre-auth defaults to system. */
    actor: text('actor').notNull(),
    /** create | update | status-change | lifecycle | delete | … */
    action: text('action').notNull(),
    /** venue | hotel | business | contact | deal | guide */
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    /** JSON snapshots, as text. */
    before: text('before'),
    after: text('after'),
    at: integer('at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index('audit_entity_idx').on(t.entityType, t.entityId),
    index('audit_at_idx').on(t.at),
  ],
)

/** The sales CRM — the business (account) that hotels belong to. */
export const businesses = sqliteTable(
  'businesses',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    website: text('website'),
    industry: text('industry'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [index('businesses_name_idx').on(t.name)],
)

/** The sales CRM — one hotel property, secondary to a business. */
export const hotels = sqliteTable(
  'hotels',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id'),
    name: text('name').notNull().unique(),
    address: text('address'),
    /** The pin the guide generator measures proximity from. */
    lat: real('lat'),
    lon: real('lon'),
    roomCount: integer('room_count').notNull().default(0),
    website: text('website'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [index('hotels_business_idx').on(t.businessId)],
)

/** The sales CRM — a person at a business (optionally at one of its hotels). */
export const contacts = sqliteTable(
  'contacts',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    hotelId: text('hotel_id'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    email: text('email'),
    phone: text('phone'),
    title: text('title'),
    isDecisionMaker: integer('is_decision_maker', { mode: 'boolean' })
      .notNull()
      .default(false),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [index('contacts_business_idx').on(t.businessId)],
)

/**
 * The sales CRM — an annual subscription opportunity. Price is stored as
 * pricePerRoom (the rate card at deal time) with annualValue =
 * pricePerRoom × rooms computed at write, so history stays accurate even
 * if room counts change later.
 */export const deals = sqliteTable(
  'deals',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    name: text('name').notNull(),
    /** prospect | contacted | sample-sent | proposal | won | lost */
    stage: text('stage').notNull().default('prospect'),
    pricePerRoom: integer('price_per_room'),
    annualValue: integer('annual_value'),
    startDate: integer('start_date', { mode: 'timestamp_ms' }),
    renewalDate: integer('renewal_date', { mode: 'timestamp_ms' }),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index('deals_business_idx').on(t.businessId),
    index('deals_stage_idx').on(t.stage),
  ],
)

/**
 * Guides — one per hotel (V1). A guide is a SNAPSHOT produced by the
 * drafting engine: staff draft, customize, approve candidates, publish.
 * The /g/<slug> page serves only live guides.
 */
export const guides = sqliteTable(
  'guides',
  {
    id: text('id').primaryKey(),
    hotelId: text('hotel_id').notNull().unique(),
    slug: text('slug').notNull().unique(),
    /** draft | live */
    status: text('status').notNull().default('draft'),
    /** Walk minutes — converted to straight-line km at draft time. */
    radiusMin: integer('radius_min').notNull().default(20),
    /** Itinerary target count. */
    targetCount: integer('target_count').notNull().default(24),
    generatedAt: integer('generated_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [index('guides_hotel_idx').on(t.hotelId)],
)

/**
 * The snapshot's venue rows. Re-draft is a merge: qualifying rows keep
 * their position/overrides; closed venues are marked removed; generated
 * picks land as pending until staff approve them (no silent entry).
 */
export const guideVenues = sqliteTable(
  'guide_venues',
  {
    id: text('id').primaryKey(),
    guideId: text('guide_id').notNull(),
    venueId: text('venue_id').notNull(),
    /** pending | live | removed */
    status: text('status').notNull().default('pending'),
    orderKey: text('order_key').notNull(),
    /** Per-guide copy override — venue cards use it when present. */
    overrideText: text('override_text'),
    /** Featured — always kept in place on re-draft (unless venue closed). */
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index('gv_guide_idx').on(t.guideId),
    index('gv_venue_idx').on(t.venueId),
    unique('gv_guide_venue_uq').on(t.guideId, t.venueId),
  ],
)

/** Hotel-level exclusions — excluded venues never re-enter on draft. */
export const guideExcludes = sqliteTable(
  'guide_excludes',
  {
    id: text('id').primaryKey(),
    guideId: text('guide_id').notNull(),
    venueId: text('venue_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [unique('ge_guide_venue_uq').on(t.guideId, t.venueId)],
)

/** "Email me this guide" — offline-keeping captures. */
export const guideCaptures = sqliteTable(
  'guide_captures',
  {
    id: text('id').primaryKey(),
    guideId: text('guide_id').notNull(),
    email: text('email').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [index('gc_guide_idx').on(t.guideId)],
)

/** Guide analytics — route-side beacon, raw aggregates (ticket 09). */
export const guideEvents = sqliteTable(
  'guide_events',
  {
    id: text('id').primaryKey(),
    guideId: text('guide_id').notNull(),
    /** view | qr-scan | venue-click | email-captured */
    event: text('event').notNull(),
    venueId: text('venue_id'),
    happenedAt: integer('happened_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index('ge_guide_idx').on(t.guideId),
    index('ge_event_idx').on(t.event),
  ],
)
