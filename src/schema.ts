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

/** The sales CRM — one hotel property (secondary to a business). */
export const hotels = sqliteTable(
  'hotels',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    roomCount: integer('room_count').notNull().default(0),
    website: text('website'),
    /** prospect | contacted | sample-sent | proposal | won | lost */
    pipelineStage: text('pipeline_stage').notNull().default('prospect'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [index('hotels_pipeline_idx').on(t.pipelineStage)],
)
