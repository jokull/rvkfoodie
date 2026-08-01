/**
 * Drizzle schema for the platform database (D1).
 *
 * Seed shape — the full editorial model (cuisine, price level, opening
 * hours, photos, recommended dishes, confidence; guides; hotel CRM fields)
 * is charted in .wayfinder and arrives in later migrations.
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** The editorial database — one curated venue. */
export const venues = sqliteTable(
  'venues',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    category: text('category').notNull(),
    neighborhood: text('neighborhood').notNull(),
    /** draft | live | closed */
    status: text('status').notNull().default('draft'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('venues_status_idx').on(t.status)],
)

/** The sales CRM — one hotel prospect / customer. */
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('hotels_pipeline_idx').on(t.pipelineStage)],
)
