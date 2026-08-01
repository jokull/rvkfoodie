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
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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
 */
export const deals = sqliteTable(
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
