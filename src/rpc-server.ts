/**
 * SERVER-ONLY: context shape, handlers, router, and the fetch-handler mount.
 * Closes over the Kysely driver (wrapped with db-result's kyselyTryDb so every
 * query resolves a Result instead of throwing). Nothing in the browser graph
 * may reach it — the only importers are the `/api/rpc` server route and the
 * createServerFn prefetchers in ssr.ts, both of which Start strips from the
 * client build.
 *
 * The three-outcome model (per blog): handlers fold the db constraint tags
 * they know into declared errors, return happy paths, and let everything else
 * fall through as a thrown DbError that the framework sanitizes to
 * `server/internal`.
 */
import { createId } from '@paralleldrive/cuid2'
import { env } from 'cloudflare:workers'
import { EmailMessage } from 'cloudflare:email'
import { generateKeyBetween } from 'fractional-indexing'
import { err, ok, pickErrors } from 'result-rpc'
import { UniqueViolation, ForeignKeyViolation } from 'db-result'
import { tryDb } from 'db-result/d1'
import { createFetchHandler, serverRpc } from 'result-rpc/server'
import {
  db,
  decodeAuditEntry,
  decodeBusiness,
  decodeContact,
  decodeDeal,
  decodeGuide,
  decodeGuideVenue,
  decodeHotel,
  decodeLifecycleEvent,
  decodeVenue,
  decodeVenueAward,
  epochMs,
  type Db,
} from './db.js'
import type { StoredVenue } from './schema.js'
import { VENUE_AWARD_TYPES } from './schema.js'
import {
  addBusinessContract,
  addContactContract,
  addDealContract,
  addGuideExcludeContract,
  addHotelContract,
  addLifecycleEventContract,
  addVenueContract,
  approveGuideCandidatesContract,
  auditListContract,
  businessByIdContract,
  businessDealSummariesContract,
  businessListContract,
  contactsByBusinessContract,
  createGuideContract,
  dealsByBusinessContract,
  draftGuideContract,
  guideByIdContract,
  guideListContract,
  guideViewBySlugContract,
  guideViewContract,
  hotelsByBusinessContract,
  hotelsListContract,
  listLifecycleContract,
  overviewContract,
  publishGuideContract,
  recordGuideEventContract,
  removeBusinessContract,
  removeContactContract,
  removeDealContract,
  removeGuideExcludeContract,
  removeHotelContract,
  requestGuideCaptureContract,
  restoreBusinessContract,
  restoreContactContract,
  restoreDealContract,
  restoreHotelContract,
  setGuideConfigContract,
  setVenueStatusContract,
  updateBusinessContract,
  venueAwardAddContract,
  venueAwardListContract,
  venueAwardRemoveContract,
  updateContactContract,
  updateDealContract,
  updateHotelContract,
  updateGuideVenueContract,
  updateVenueContract,
  venueByIdContract,
  venueFeedContract,
  guideBuilderContract,
  digestContract,
} from './contract.js'
import { draftItinerary } from './guide-gen.js'
import { auth } from './auth.js'
import { authErrors } from './errors.js'

const toJson = (v: unknown): string => JSON.stringify(v)
const toBit = (b: boolean): 0 | 1 => (b ? 1 : 0)

export interface AppContext {
  db: Db
  /** The signed-in session for this request — null when public. */
  session: Awaited<ReturnType<typeof auth.api.getSession>> | null
}

const server = serverRpc.context<AppContext>()

/** Staff gate — the shared contract must declare the auth error it raises. */
const requireStaff = server
  .middleware()
  .errors({ ...pickErrors(authErrors, 'unauthorized') })
  .use(async ({ context, errors, next }) => {
    if (context.session) return next({ context })
    return err(errors.unauthorized())
  })

/** Audit actor: the signed-in session's email when present (MCP sessions
 * report mcp@rvkfoodie.is), else 'system'. */
const actorOf = (context: AppContext) => context.session?.user.email ?? 'system'

const PAGE_SIZE = 50

const slugFromName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** The public guide-view venue projection (Venue.pick fields, exactly). */
const venuePublic = (v: StoredVenue) => ({
  id: v.id,
  name: v.name,
  category: v.category,
  categorySecondary: v.categorySecondary,
  address: v.address,
  openingHours: v.openingHours,
  note: v.note,
  recommendedDishes: v.recommendedDishes,
  dineoutId: v.dineoutId,
  website: v.website,
  phone: v.phone,
  lat: v.lat,
  lon: v.lon,
  confidence: v.confidence,
  photos: v.photos,
})

/** Fire-and-forget audit write — a failing audit entry never fails the
 * mutation that triggered it. */
const audit = async (
  db: Db,
  entry: {
    actor: string
    action: string
    entityType: string
    entityId: string
    before?: unknown
    after?: unknown
  },
) => {
  try {
    await db
      .insertInto('audit_log')
      .values({
        id: createId(),
        actor: entry.actor,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        before: entry.before === undefined ? null : JSON.stringify(entry.before),
        after: entry.after === undefined ? null : JSON.stringify(entry.after),
        at: Date.now(),
      })
      .execute()
  } catch {
    // audit is best-effort
  }
}

const venueFeed = server.implement(venueFeedContract).handler(async ({ input, context }) => {
  // The feed is curated order: fractional-index orderKey, not id.
  let q = context.db
    .selectFrom('venues')
    .selectAll()
    .orderBy('order_key', 'asc')
    .limit(PAGE_SIZE + 1)
  if (input.cursor !== null) q = q.where('order_key', '>', input.cursor)
  const rows = (await tryDb(() => q.execute())).unwrap()
  const page = rows.slice(0, PAGE_SIZE)
  return ok({
    items: page.map(decodeVenue),
    nextCursor: rows.length > PAGE_SIZE ? (page[page.length - 1]?.order_key ?? null) : null,
  })
})

const venueById = server.implement(venueByIdContract).handler(async ({ input, errors, context }) => {
  const row = await context.db.selectFrom('venues').selectAll().where('id', '=', input.id).executeTakeFirst()
  if (!row) return err(errors.notFound({ venueId: input.id }))
  return ok(decodeVenue(row))
})

const addVenue = server.implement(addVenueContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const last = await context.db
    .selectFrom('venues')
    .select(['order_key'])
    .orderBy('order_key', 'desc')
    .limit(1)
    .executeTakeFirst()
  const row = {
    id: createId(),
    name: input.name,
    category: input.category,
    category_secondary: input.categorySecondary ?? null,
    status: 'draft',
    order_key: generateKeyBetween(last?.order_key ?? null, null),
    cuisine: input.cuisine ?? null,
    price_level: input.priceLevel ?? null,
    tags: '[]',
    note: input.note ?? null,
    recommended_dishes: '[]',
    last_verified_at: null,
    confidence: 0,
    source: 'editorial',
    address: input.address,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    google_places_id: input.googlePlacesId ?? null,
    dineout_id: input.dineoutId ?? null,
    website: input.website ?? null,
    phone: input.phone ?? null,
    opening_hours: input.openingHours ?? null,
    photos: '[]',
    created_at: Date.now(),
    updated_at: Date.now(),
  }
  const inserted = await tryDb(() =>
    context.db.insertInto('venues').values(row).returningAll().executeTakeFirstOrThrow(),
  )
  if (inserted.isErr()) {
    if (UniqueViolation.is(inserted.error)) return err(errors.nameTaken({ name: input.name }))
    throw inserted.error
  }
  await audit(context.db, {
    actor: actorOf(context),
    action: 'create',
    entityType: 'venue',
    entityId: inserted.value.id,
    after: row,
  })
  return ok(decodeVenue(inserted.value))
})

const updateVenue = server.implement(updateVenueContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const before = await context.db.selectFrom('venues').selectAll().where('id', '=', input.id).executeTakeFirst()
  if (!before) return err(errors.notFound({ venueId: input.id }))
  const set = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.categorySecondary !== undefined ? { category_secondary: input.categorySecondary } : {}),
    ...(input.cuisine !== undefined ? { cuisine: input.cuisine } : {}),
    ...(input.priceLevel !== undefined ? { price_level: input.priceLevel } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.openingHours !== undefined ? { opening_hours: input.openingHours } : {}),
    ...(input.dineoutId !== undefined ? { dineout_id: input.dineoutId } : {}),
    ...(input.googlePlacesId !== undefined ? { google_places_id: input.googlePlacesId } : {}),
    ...(input.website !== undefined ? { website: input.website } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
    ...(input.lastVerifiedAt !== undefined ? { last_verified_at: epochMs(input.lastVerifiedAt) } : {}),
    ...(input.lat !== undefined ? { lat: input.lat } : {}),
    ...(input.lon !== undefined ? { lon: input.lon } : {}),
    ...(input.tags !== undefined ? { tags: toJson(input.tags) } : {}),
    ...(input.recommendedDishes !== undefined ? { recommended_dishes: toJson(input.recommendedDishes) } : {}),
    ...(input.photos !== undefined ? { photos: toJson(input.photos) } : {}),
    updated_at: Date.now(),
  }
  const updated = await tryDb(() =>
    context.db
      .updateTable('venues')
      .set(set)
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirstOrThrow(),
  )
  if (updated.isErr()) {
    if (UniqueViolation.is(updated.error)) return err(errors.nameTaken({ name: input.name ?? before.name }))
    throw updated.error
  }
  const afterRow = updated.value
  await audit(context.db, {
    actor: actorOf(context),
    action: 'update',
    entityType: 'venue',
    entityId: afterRow.id,
    before,
    after: afterRow,
  })
  return ok(decodeVenue(afterRow))
})

const setVenueStatus = server
  .implement(setVenueStatusContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const before = await context.db.selectFrom('venues').selectAll().where('id', '=', input.id).executeTakeFirst()
    if (!before) return err(errors.notFound({ venueId: input.id }))
    const updated = await tryDb(() =>
      context.db
        .updateTable('venues')
        .set({ status: input.status, updated_at: Date.now() })
        .where('id', '=', input.id)
        .returningAll()
        .executeTakeFirstOrThrow(),
    )
    if (updated.isErr()) throw updated.error
    await audit(context.db, {
      actor: actorOf(context),
      action: 'status-change',
      entityType: 'venue',
      entityId: input.id,
      before: { status: before.status },
      after: { status: input.status },
    })
    return ok(decodeVenue(updated.value))
  })

const addLifecycleEvent = server
  .implement(addLifecycleEventContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const venue = await context.db.selectFrom('venues').selectAll().where('id', '=', input.venueId).executeTakeFirst()
    if (!venue) return err(errors.notFound({ venueId: input.venueId }))

    // The lifecycle event mechanically drives venue status + confidence:
    // closure → status closed, confidence 0; reopened → status live.
    const nextStatus = input.type === 'closed' || input.type === 'temporarily-closed' ? 'closed' : 'live'
    const venueUpdate = await tryDb(() =>
      context.db
        .updateTable('venues')
        .set(
          nextStatus === 'closed'
            ? { status: 'closed', confidence: 0, updated_at: Date.now() }
            : { status: 'live', updated_at: Date.now() },
        )
        .where('id', '=', input.venueId)
        .executeTakeFirstOrThrow(),
    )
    if (venueUpdate.isErr()) throw venueUpdate.error

    const row = {
      id: createId(),
      venue_id: input.venueId,
      type: input.type,
      started_at: epochMs(input.startedAt),
      ended_at: null,
      note: input.note ?? null,
      created_at: Date.now(),
    }
    const inserted = await tryDb(() =>
      context.db
        .insertInto('venue_lifecycle_events')
        .values(row)
        .returningAll()
        .executeTakeFirstOrThrow(),
    )
    if (inserted.isErr()) throw inserted.error
    await audit(context.db, {
      actor: actorOf(context),
      action: 'lifecycle',
      entityType: 'venue',
      entityId: input.venueId,
      after: { type: input.type, startedAt: input.startedAt },
    })
    return ok(decodeLifecycleEvent(inserted.value))
  })

const listLifecycle = server.implement(listLifecycleContract).handler(async ({ input, context }) => {
  const rows = await context.db
    .selectFrom('venue_lifecycle_events')
    .selectAll()
    .where('venue_id', '=', input.venueId)
    .orderBy('started_at', 'desc')
    .execute()
  return ok(rows.map(decodeLifecycleEvent))
})

const listAwards = server.implement(venueAwardListContract).handler(async ({ input, errors, context }) => {
  const venue = await context.db.selectFrom('venues').selectAll().where('id', '=', input.venueId).executeTakeFirst()
  if (!venue) return err(errors.notFound({ venueId: input.venueId }))
  const rows = await context.db
    .selectFrom('venue_awards')
    .selectAll()
    .where('venue_id', '=', input.venueId)
    .orderBy('created_at', 'desc')
    .execute()
  return ok(rows.map(decodeVenueAward))
})

const addAward = server.implement(venueAwardAddContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const venue = await context.db.selectFrom('venues').selectAll().where('id', '=', input.venueId).executeTakeFirst()
  if (!venue) return err(errors.notFound({ venueId: input.venueId }))
  const inserted = await tryDb(() =>
    context.db
      .insertInto('venue_awards')
      .values({
        id: createId(),
        venue_id: input.venueId,
        award_type: input.awardType as (typeof VENUE_AWARD_TYPES)[number],
        title: input.title,
        url: input.url ?? null,
        created_at: Date.now(),
      })
      .returningAll()
      .executeTakeFirstOrThrow(),
  )
  if (inserted.isErr()) {
    if (UniqueViolation.is(inserted.error)) return err(errors.exists({ venueId: input.venueId }))
    throw inserted.error
  }
  await audit(context.db, {
    actor: actorOf(context),
    action: 'venue.award.add',
    entityType: 'venue',
    entityId: input.venueId,
    after: { awardType: input.awardType, title: input.title, url: input.url ?? null },
  })
  return ok(decodeVenueAward(inserted.value))
})

const removeAward = server.implement(venueAwardRemoveContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const row = await context.db.deleteFrom('venue_awards').where('id', '=', input.id).returningAll().executeTakeFirst()
  if (!row) return err(errors.notFound({ awardId: input.id }))
  await audit(context.db, {
    actor: actorOf(context),
    action: 'venue.award.remove',
    entityType: 'venue',
    entityId: row.venue_id,
    before: { awardType: row.award_type, title: row.title },
  })
  return ok({ removed: true })
})

const auditList = server.implement(auditListContract).handler(async ({ input, context }) => {
  const rows = await context.db
    .selectFrom('audit_log')
    .selectAll()
    .where('entity_type', '=', input.entityType)
    .where('entity_id', '=', input.entityId)
    .orderBy('at', 'desc')
    .limit(50)
    .execute()
  return ok(rows.map(decodeAuditEntry))
})

const hotelsList = server.implement(hotelsListContract).handler(async ({ context }) => {
  const rows = await context.db
    .selectFrom('hotels')
    .selectAll()
    .where('deleted_at', 'is', null)
    .orderBy('name', 'asc')
    .execute()
  return ok(rows.map(decodeHotel))
})

const hotelsByBusiness = server
  .implement(hotelsByBusinessContract)
  .handler(async ({ input, context }) => {
    const rows = await context.db
      .selectFrom('hotels')
      .selectAll()
      .where('business_id', '=', input.businessId)
      .where('deleted_at', 'is', null)
      .orderBy('name', 'asc')
      .execute()
    return ok(rows.map(decodeHotel))
  })

const addHotel = server
  .implement(addHotelContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
  const row = {
    id: createId(),
    business_id: input.businessId ?? null,
    name: input.name,
    address: input.address ?? null,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    room_count: input.roomCount ?? 0,
    website: input.website ?? null,
    notes: input.notes ?? null,
    created_at: Date.now(),
    updated_at: Date.now(),
  }
  const inserted = await tryDb(() =>
    context.db
      .insertInto('hotels')
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow(),
  )
  if (inserted.isErr()) {
    if (UniqueViolation.is(inserted.error)) return err(errors.notFound({ hotelId: input.name }))
    if (ForeignKeyViolation.is(inserted.error)) return err(errors.notFound({ hotelId: input.businessId ?? '' }))
    throw inserted.error
  }
  await audit(context.db, {
    actor: actorOf(context),
    action: 'create',
    entityType: 'hotel',
    entityId: inserted.value.id,
    after: row,
  })
  return ok(decodeHotel(inserted.value))
})

const updateHotel = server.implement(updateHotelContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const before = await context.db
    .selectFrom('hotels')
    .selectAll()
    .where('id', '=', input.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()
  if (!before) return err(errors.notFound({ hotelId: input.id }))
  const set = {
    ...(input.businessId !== undefined ? { business_id: input.businessId } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.lat !== undefined ? { lat: input.lat } : {}),
    ...(input.lon !== undefined ? { lon: input.lon } : {}),
    ...(input.roomCount !== undefined ? { room_count: input.roomCount } : {}),
    ...(input.website !== undefined ? { website: input.website } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    updated_at: Date.now(),
  }
  const updated = await tryDb(() =>
    context.db
      .updateTable('hotels')
      .set(set)
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirstOrThrow(),
  )
  if (updated.isErr()) {
    if (UniqueViolation.is(updated.error)) return err(errors.notFound({ hotelId: input.name ?? before.name }))
    if (ForeignKeyViolation.is(updated.error)) return err(errors.notFound({ hotelId: input.businessId ?? '' }))
    throw updated.error
  }
  const afterRow = updated.value
  await audit(context.db, {
    actor: actorOf(context),
    action: 'update',
    entityType: 'hotel',
    entityId: afterRow.id,
    before,
    after: afterRow,
  })
  return ok(decodeHotel(afterRow))
})

const removeHotel = server
  .implement(removeHotelContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const before = await context.db.selectFrom('hotels').selectAll().where('id', '=', input.id).executeTakeFirst()
    if (!before) return err(errors.notFound({ hotelId: input.id }))
    const now = Date.now()
    const row = await context.db
      .updateTable('hotels')
      .set({ deleted_at: now, updated_at: now })
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirst()
    if (!row) return err(errors.notFound({ hotelId: input.id }))
    await audit(context.db, {
      actor: actorOf(context),
      action: 'delete',
      entityType: 'hotel',
      entityId: input.id,
      before,
      after: row,
    })
    return ok({ removed: true })
  })

const restoreHotel = server
  .implement(restoreHotelContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const before = await context.db.selectFrom('hotels').selectAll().where('id', '=', input.id).executeTakeFirst()
    if (!before) return err(errors.notFound({ hotelId: input.id }))
    const row = await context.db
      .updateTable('hotels')
      .set({ deleted_at: null, updated_at: Date.now() })
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirst()
    if (!row) return err(errors.notFound({ hotelId: input.id }))
    await audit(context.db, {
      actor: actorOf(context),
      action: 'restore',
      entityType: 'hotel',
      entityId: input.id,
      before,
      after: row,
    })
    return ok(decodeHotel(row))
  })

// --- CRM handlers ---------------------------------------------------------

const businessList = server.implement(businessListContract).handler(async ({ context }) => {
  const rows = await context.db
    .selectFrom('businesses')
    .selectAll()
    .where('deleted_at', 'is', null)
    .orderBy('name', 'asc')
    .execute()
  return ok(rows.map(decodeBusiness))
})

/** Latest stage + summed annual value per business, for the CRM list column. */
const businessDealSummaries = server.implement(businessDealSummariesContract).handler(async ({ context }) => {
  const rows = await context.db
    .selectFrom('deals')
    .select(['business_id', 'stage', 'annual_value', 'updated_at'])
    .where('deleted_at', 'is', null)
    .execute()
  const acc = new Map<string, { stage: string; annualValue: number; dealCount: number; updatedAt: number }>()
  for (const r of rows) {
    const t = r.updated_at ?? 0
    const cur = acc.get(r.business_id)
    if (!cur) {
      acc.set(r.business_id, { stage: r.stage, annualValue: r.annual_value ?? 0, dealCount: 1, updatedAt: t })
    } else {
      cur.dealCount += 1
      cur.annualValue += r.annual_value ?? 0
      if (t > cur.updatedAt) {
        cur.updatedAt = t
        cur.stage = r.stage
      }
    }
  }
  return ok(
    [...acc.entries()].map(([businessId, s]) => ({
      businessId,
      stage: s.stage,
      annualValue: s.annualValue,
      dealCount: s.dealCount,
    })),
  )
})

const businessById = server
  .implement(businessByIdContract)
  .handler(async ({ input, errors, context }) => {
    const row = await context.db
      .selectFrom('businesses')
      .selectAll()
      .where('id', '=', input.id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!row) return err(errors.notFound({ businessId: input.id }))
    return ok(decodeBusiness(row))
  })

const addBusiness = server
  .implement(addBusinessContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const row = {
      id: createId(),
      name: input.name,
      website: input.website ?? null,
      industry: input.industry ?? null,
      notes: input.notes ?? null,
      created_at: Date.now(),
      updated_at: Date.now(),
    }
    const inserted = await tryDb(() =>
      context.db
        .insertInto('businesses')
        .values(row)
        .returningAll()
        .executeTakeFirstOrThrow(),
    )
    if (inserted.isErr()) {
      if (UniqueViolation.is(inserted.error)) return err(errors.nameTaken({ name: input.name }))
      throw inserted.error
    }
    await audit(context.db, {
      actor: actorOf(context),
      action: 'create',
      entityType: 'business',
      entityId: inserted.value.id,
      after: row,
    })
    return ok(decodeBusiness(inserted.value))
  })

const updateBusiness = server
  .implement(updateBusinessContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const before = await context.db
      .selectFrom('businesses')
      .selectAll()
      .where('id', '=', input.id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!before) return err(errors.notFound({ businessId: input.id }))
    const set = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.industry !== undefined ? { industry: input.industry } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updated_at: Date.now(),
    }
    const updated = await tryDb(() =>
      context.db
        .updateTable('businesses')
        .set(set)
        .where('id', '=', input.id)
        .returningAll()
        .executeTakeFirstOrThrow(),
    )
    if (updated.isErr()) {
      if (UniqueViolation.is(updated.error)) return err(errors.nameTaken({ name: input.name ?? before.name }))
      throw updated.error
    }
    const afterRow = updated.value
    await audit(context.db, {
      actor: actorOf(context),
      action: 'update',
      entityType: 'business',
      entityId: afterRow.id,
      before,
      after: afterRow,
    })
    return ok(decodeBusiness(afterRow))
  })

const removeBusiness = server
  .implement(removeBusinessContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const before = await context.db.selectFrom('businesses').selectAll().where('id', '=', input.id).executeTakeFirst()
    if (!before) return err(errors.notFound({ businessId: input.id }))
    // No FK constraints on the CRM tables — soft-delete children explicitly.
    const now = Date.now()
    await context.db.updateTable('deals').set({ deleted_at: now, updated_at: now }).where('business_id', '=', input.id).execute()
    await context.db.updateTable('contacts').set({ deleted_at: now, updated_at: now }).where('business_id', '=', input.id).execute()
    await context.db.updateTable('hotels').set({ deleted_at: now, updated_at: now }).where('business_id', '=', input.id).execute()
    const row = await context.db
      .updateTable('businesses')
      .set({ deleted_at: now, updated_at: now })
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirst()
    if (!row) return err(errors.notFound({ businessId: input.id }))
    await audit(context.db, {
      actor: actorOf(context),
      action: 'delete',
      entityType: 'business',
      entityId: input.id,
      before,
      after: row,
    })
    return ok({ removed: true })
  })

const restoreBusiness = server
  .implement(restoreBusinessContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const before = await context.db.selectFrom('businesses').selectAll().where('id', '=', input.id).executeTakeFirst()
    if (!before) return err(errors.notFound({ businessId: input.id }))
    // Restore the account: the business plus children soft-deleted together
    // with it (same deleted_at timestamp from the cascade). Children deleted
    // independently earlier stay deleted.
    const deletedAt = before.deleted_at
    const row = await context.db
      .updateTable('businesses')
      .set({ deleted_at: null, updated_at: Date.now() })
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirst()
    if (!row) return err(errors.notFound({ businessId: input.id }))
    if (deletedAt !== null) {
      await context.db
        .updateTable('deals')
        .set({ deleted_at: null, updated_at: Date.now() })
        .where('business_id', '=', input.id)
        .where('deleted_at', '=', deletedAt)
        .execute()
      await context.db
        .updateTable('contacts')
        .set({ deleted_at: null, updated_at: Date.now() })
        .where('business_id', '=', input.id)
        .where('deleted_at', '=', deletedAt)
        .execute()
      await context.db
        .updateTable('hotels')
        .set({ deleted_at: null, updated_at: Date.now() })
        .where('business_id', '=', input.id)
        .where('deleted_at', '=', deletedAt)
        .execute()
    }
    await audit(context.db, {
      actor: actorOf(context),
      action: 'restore',
      entityType: 'business',
      entityId: input.id,
      before,
      after: row,
    })
    return ok(decodeBusiness(row))
  })

const contactsByBusiness = server
  .implement(contactsByBusinessContract)
  .handler(async ({ input, context }) => {
    const rows = await context.db
      .selectFrom('contacts')
      .selectAll()
      .where('business_id', '=', input.businessId)
      .where('deleted_at', 'is', null)
      .orderBy('last_name', 'asc')
      .orderBy('first_name', 'asc')
      .execute()
    return ok(rows.map(decodeContact))
  })

const addContact = server
  .implement(addContactContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
  const row = {
    id: createId(),
    business_id: input.businessId,
    hotel_id: input.hotelId ?? null,
    first_name: input.firstName ?? null,
    last_name: input.lastName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    title: input.title ?? null,
    is_decision_maker: toBit(input.isDecisionMaker ?? false),
    notes: input.notes ?? null,
    created_at: Date.now(),
    updated_at: Date.now(),
  }
  const inserted = await tryDb(() =>
    context.db
      .insertInto('contacts')
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow(),
  )
  if (inserted.isErr()) throw inserted.error
  await audit(context.db, {
    actor: actorOf(context),
    action: 'create',
    entityType: 'contact',
    entityId: inserted.value.id,
    after: row,
  })
  return ok(decodeContact(inserted.value))
})

const updateContact = server
  .implement(updateContactContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const before = await context.db
      .selectFrom('contacts')
      .selectAll()
      .where('id', '=', input.id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!before) return err(errors.notFound({ contactId: input.id }))
    const set = {
      ...(input.hotelId !== undefined ? { hotel_id: input.hotelId } : {}),
      ...(input.firstName !== undefined ? { first_name: input.firstName } : {}),
      ...(input.lastName !== undefined ? { last_name: input.lastName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.isDecisionMaker !== undefined ? { is_decision_maker: toBit(input.isDecisionMaker) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updated_at: Date.now(),
    }
    const updated = await tryDb(() =>
      context.db
        .updateTable('contacts')
        .set(set)
        .where('id', '=', input.id)
        .returningAll()
        .executeTakeFirstOrThrow(),
    )
    if (updated.isErr()) throw updated.error
    await audit(context.db, {
      actor: actorOf(context),
      action: 'update',
      entityType: 'contact',
      entityId: input.id,
      before,
      after: updated.value,
    })
    return ok(decodeContact(updated.value))
  })

const removeContact = server
  .implement(removeContactContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const before = await context.db.selectFrom('contacts').selectAll().where('id', '=', input.id).executeTakeFirst()
    if (!before) return err(errors.notFound({ contactId: input.id }))
    const now = Date.now()
    const row = await context.db
      .updateTable('contacts')
      .set({ deleted_at: now, updated_at: now })
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirst()
    if (!row) return err(errors.notFound({ contactId: input.id }))
    await audit(context.db, {
      actor: actorOf(context),
      action: 'delete',
      entityType: 'contact',
      entityId: input.id,
      before,
      after: row,
    })
    return ok({ removed: true })
  })

const restoreContact = server
  .implement(restoreContactContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const before = await context.db.selectFrom('contacts').selectAll().where('id', '=', input.id).executeTakeFirst()
    if (!before) return err(errors.notFound({ contactId: input.id }))
    const row = await context.db
      .updateTable('contacts')
      .set({ deleted_at: null, updated_at: Date.now() })
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirst()
    if (!row) return err(errors.notFound({ contactId: input.id }))
    await audit(context.db, {
      actor: actorOf(context),
      action: 'restore',
      entityType: 'contact',
      entityId: input.id,
      before,
      after: row,
    })
    return ok(decodeContact(row))
  })

const dealsByBusiness = server
  .implement(dealsByBusinessContract)
  .handler(async ({ input, context }) => {
    const rows = await context.db
      .selectFrom('deals')
      .selectAll()
      .where('business_id', '=', input.businessId)
      .where('deleted_at', 'is', null)
      .orderBy('updated_at', 'desc')
      .execute()
    return ok(rows.map(decodeDeal))
  })

/** annualValue = pricePerRoom × total rooms across the business's hotels. */
const computedAnnualValue = async (db: Db, businessId: string, pricePerRoom: number) => {
  const total = await db
    .selectFrom('hotels')
    .select((eb) => eb.fn.sum('room_count').as('n'))
    .where('business_id', '=', businessId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()
  return pricePerRoom * Number(total?.n ?? 0)
}

const addDeal = server
  .implement(addDealContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
  const annualValue =
    input.annualValue ??
    (input.pricePerRoom !== undefined
      ? await computedAnnualValue(context.db, input.businessId, input.pricePerRoom)
      : undefined)
  const row = {
    id: createId(),
    business_id: input.businessId,
    name: input.name,
    stage: input.stage ?? 'prospect',
    price_per_room: input.pricePerRoom ?? null,
    annual_value: annualValue ?? null,
    start_date: input.startDate ? epochMs(input.startDate) : null,
    renewal_date: input.renewalDate ? epochMs(input.renewalDate) : null,
    notes: input.notes ?? null,
    created_at: Date.now(),
    updated_at: Date.now(),
  }
  const inserted = await tryDb(() =>
    context.db
      .insertInto('deals')
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow(),
  )
  if (inserted.isErr()) throw inserted.error
  await audit(context.db, {
    actor: actorOf(context),
    action: 'create',
    entityType: 'deal',
    entityId: inserted.value.id,
    after: row,
  })
  return ok(decodeDeal(inserted.value))
})

const updateDeal = server.implement(updateDealContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const before = await context.db
    .selectFrom('deals')
    .selectAll()
    .where('id', '=', input.id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()
  if (!before) return err(errors.notFound({ dealId: input.id }))
  const annualValue =
    input.annualValue ??
    (input.pricePerRoom !== undefined
      ? await computedAnnualValue(context.db, before.business_id, input.pricePerRoom)
      : undefined)
  const set = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.stage !== undefined ? { stage: input.stage } : {}),
    ...(input.pricePerRoom !== undefined ? { price_per_room: input.pricePerRoom } : {}),
    ...(annualValue !== undefined ? { annual_value: annualValue } : {}),
    ...(input.startDate !== undefined ? { start_date: epochMs(input.startDate) } : {}),
    ...(input.renewalDate !== undefined ? { renewal_date: epochMs(input.renewalDate) } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    updated_at: Date.now(),
  }
  const updated = await tryDb(() =>
    context.db
      .updateTable('deals')
      .set(set)
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirstOrThrow(),
  )
  if (updated.isErr()) throw updated.error
  await audit(context.db, {
    actor: actorOf(context),
    action: 'update',
    entityType: 'deal',
    entityId: input.id,
    before,
    after: updated.value,
  })
  return ok(decodeDeal(updated.value))
})

const removeDeal = server
  .implement(removeDealContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const before = await context.db.selectFrom('deals').selectAll().where('id', '=', input.id).executeTakeFirst()
    if (!before) return err(errors.notFound({ dealId: input.id }))
    const now = Date.now()
    const row = await context.db
      .updateTable('deals')
      .set({ deleted_at: now, updated_at: now })
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirst()
    if (!row) return err(errors.notFound({ dealId: input.id }))
    await audit(context.db, {
      actor: actorOf(context),
      action: 'delete',
      entityType: 'deal',
      entityId: input.id,
      before,
      after: row,
    })
    return ok({ removed: true })
  })

const restoreDeal = server
  .implement(restoreDealContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const before = await context.db.selectFrom('deals').selectAll().where('id', '=', input.id).executeTakeFirst()
    if (!before) return err(errors.notFound({ dealId: input.id }))
    const row = await context.db
      .updateTable('deals')
      .set({ deleted_at: null, updated_at: Date.now() })
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirst()
    if (!row) return err(errors.notFound({ dealId: input.id }))
    await audit(context.db, {
      actor: actorOf(context),
      action: 'restore',
      entityType: 'deal',
      entityId: input.id,
      before,
      after: row,
    })
    return ok(decodeDeal(row))
  })

const overview = server.implement(overviewContract).handler(async ({ context }) => {
  const venueCount = (
    await context.db.selectFrom('venues').select((eb) => eb.fn.countAll<number>().as('n')).executeTakeFirst()
  )?.n ?? 0
  const liveVenueCount = (
    await context.db
      .selectFrom('venues')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('status', '=', 'live')
      .executeTakeFirst()
  )?.n ?? 0
  const hotelCount = (
    await context.db
      .selectFrom('hotels')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
  )?.n ?? 0
  return ok({ venueCount, liveVenueCount, hotelCount })
})

/** Fire-and-forget: drop silently if the guide is missing. */
const recordGuideEvent = server
  .implement(recordGuideEventContract)
  .handler(async ({ input, context }) => {
    const guide = await context.db.selectFrom('guides').selectAll().where('slug', '=', input.slug).executeTakeFirst()
    if (!guide) return ok({})
    await context.db
      .insertInto('guide_events')
      .values({
        id: createId(),
        guide_id: guide.id,
        event: input.event,
        venue_id: input.venueId ?? null,
        happened_at: Date.now(),
      })
      .execute()
    return ok({})
  })

// --- Guide handlers -------------------------------------------------------

const guideList = server.implement(guideListContract).handler(async ({ context }) => {
  const rows = await context.db.selectFrom('guides').selectAll().orderBy('slug', 'asc').execute()
  return ok(rows.map(decodeGuide))
})

const guideById = server.implement(guideByIdContract).handler(async ({ input, errors, context }) => {
  const row = await context.db.selectFrom('guides').selectAll().where('id', '=', input.id).executeTakeFirst()
  if (!row) return err(errors.notFound({ guideId: input.id }))
  return ok(decodeGuide(row))
})

const createGuide = server.implement(createGuideContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const hotel = await context.db
    .selectFrom('hotels')
    .selectAll()
    .where('id', '=', input.hotelId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()
  if (!hotel) return err(errors.notFound({ guideId: input.hotelId }))
  const existing = await context.db.selectFrom('guides').selectAll().where('hotel_id', '=', input.hotelId).executeTakeFirst()
  if (existing) return ok(decodeGuide(existing))
  const row = {
    id: createId(),
    hotel_id: input.hotelId,
    slug: slugFromName(hotel.name),
    status: 'draft',
    radius_min: input.radiusMin ?? 20,
    target_count: input.targetCount ?? 24,
    generated_at: null,
    last_digest_at: null,
    last_digest_venue_ids: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  }
  const inserted = await tryDb(() =>
    context.db
      .insertInto('guides')
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow(),
  )
  if (inserted.isErr()) throw inserted.error
  await audit(context.db, {
    actor: actorOf(context),
    action: 'create',
    entityType: 'guide',
    entityId: inserted.value.id,
    after: row,
  })
  return ok(decodeGuide(inserted.value))
})

const draftGuide = server.implement(draftGuideContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const guide = await context.db.selectFrom('guides').selectAll().where('id', '=', input.id).executeTakeFirst()
  if (!guide) return err(errors.notFound({ guideId: input.id }))
  const hotel = await context.db.selectFrom('hotels').selectAll().where('id', '=', guide.hotel_id).executeTakeFirst()
  if (!hotel || hotel.lat === null || hotel.lon === null) {
    return err(errors.noPool({ guideId: input.id }))
  }

  const excluded = await context.db
    .selectFrom('guide_excludes')
    .select(['venue_id'])
    .where('guide_id', '=', input.id)
    .execute()
  const excludedIds = new Set(excluded.map((r) => r.venue_id))

  const existingRows = await context.db
    .selectFrom('guide_venues')
    .selectAll()
    .where('guide_id', '=', input.id)
    .where('status', '!=', 'removed')
    .execute()
  const existingIds = existingRows.map((r) => r.venue_id)
  const venueStatus = new Map<string, string>()
  if (existingIds.length > 0) {
    const vs = await context.db
      .selectFrom('venues')
      .select(['id', 'status'])
      .where('id', 'in', existingIds)
      .execute()
    for (const v of vs) venueStatus.set(v.id, v.status)
  }

  // Merge: keep qualifying rows in place (status-only silent disqualifier);
  // closed venues are marked removed.
  const kept: string[] = []
  const dropped: string[] = []
  let lastOrderKey: string | null = null
  const now = Date.now()
  for (const row of existingRows) {
    if (venueStatus.get(row.venue_id) === 'live') {
      kept.push(row.venue_id)
      if (lastOrderKey === null || row.order_key > lastOrderKey) lastOrderKey = row.order_key
    } else {
      dropped.push(row.venue_id)
      await context.db
        .updateTable('guide_venues')
        .set({ status: 'removed', updated_at: now })
        .where('id', '=', row.id)
        .execute()
    }
  }

  // Pool: live venues, not already in the guide, not excluded, with coords.
  const poolRows = await context.db
    .selectFrom('venues')
    .select(['id', 'category', 'lat', 'lon', 'confidence'])
    .where('status', '=', 'live')
    .execute()
  const pool = poolRows.filter(
    (v) => !excludedIds.has(v.id) && !new Set([...kept, ...dropped]).has(v.id),
  )

  const picks = draftItinerary({
    hotel: { lat: hotel.lat, lon: hotel.lon },
    radiusMin: guide.radius_min,
    targetCount: guide.target_count,
    pool,
    lastOrderKey,
  })
  for (const pick of picks) {
    await context.db
      .insertInto('guide_venues')
      .values({
        id: createId(),
        guide_id: input.id,
        venue_id: pick.venueId,
        status: 'pending',
        order_key: pick.orderKey,
        override_text: null,
        pinned: 0,
        created_at: now,
        updated_at: now,
      })
      .execute()
  }
  await context.db
    .updateTable('guides')
    .set({ generated_at: now, updated_at: now })
    .where('id', '=', input.id)
    .execute()
  await audit(context.db, {
    actor: actorOf(context),
    action: 'draft',
    entityType: 'guide',
    entityId: input.id,
    after: { kept: kept.length, dropped, added: picks.map((p) => p.venueId) },
  })
  return ok({ kept: kept.length, dropped, added: picks.map((p) => p.venueId) })
})

const approveGuideCandidates = server
  .implement(approveGuideCandidatesContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const guide = await context.db.selectFrom('guides').selectAll().where('id', '=', input.guideId).executeTakeFirst()
    if (!guide) return err(errors.notFound({ guideId: input.guideId }))
    const rows = await context.db
      .selectFrom('guide_venues')
      .selectAll()
      .where('guide_id', '=', input.guideId)
      .where('status', '=', 'pending')
      .where('venue_id', 'in', input.venueIds)
      .execute()
    const now = Date.now()
    for (const row of rows) {
      await context.db
        .updateTable('guide_venues')
        .set({ status: 'live', updated_at: now })
        .where('id', '=', row.id)
        .execute()
    }
    await audit(context.db, {
      actor: actorOf(context),
      action: 'approve-candidates',
      entityType: 'guide',
      entityId: input.guideId,
      after: { venueIds: input.venueIds },
    })
    return ok(rows.map(decodeGuideVenue))
  })

const setGuideConfig = server
  .implement(setGuideConfigContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const guide = await context.db.selectFrom('guides').selectAll().where('id', '=', input.guideId).executeTakeFirst()
    if (!guide) return err(errors.notFound({ guideId: input.guideId }))
    const updated = await tryDb(() =>
      context.db
        .updateTable('guides')
        .set({
          ...(input.radiusMin !== undefined ? { radius_min: input.radiusMin } : {}),
          ...(input.targetCount !== undefined ? { target_count: input.targetCount } : {}),
          updated_at: Date.now(),
        })
        .where('id', '=', input.guideId)
        .returningAll()
        .executeTakeFirstOrThrow(),
    )
    if (updated.isErr()) throw updated.error
    await audit(context.db, {
      actor: actorOf(context),
      action: 'config-change',
      entityType: 'guide',
      entityId: input.guideId,
      before: { radiusMin: guide.radius_min, targetCount: guide.target_count },
      after: { radiusMin: updated.value.radius_min, targetCount: updated.value.target_count },
    })
    return ok(decodeGuide(updated.value))
  })

const publishGuide = server.implement(publishGuideContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const guide = await context.db.selectFrom('guides').selectAll().where('id', '=', input.id).executeTakeFirst()
  if (!guide) return err(errors.notFound({ guideId: input.id }))
  const updated = await tryDb(() =>
    context.db
      .updateTable('guides')
      .set({ status: 'live', updated_at: Date.now() })
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirstOrThrow(),
  )
  if (updated.isErr()) throw updated.error
  await audit(context.db, {
    actor: actorOf(context),
    action: 'publish',
    entityType: 'guide',
    entityId: input.id,
    before: { status: guide.status },
    after: { status: 'live' },
  })
  return ok(decodeGuide(updated.value))
})

const addGuideExclude = server
  .implement(addGuideExcludeContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const guide = await context.db.selectFrom('guides').selectAll().where('id', '=', input.guideId).executeTakeFirst()
    if (!guide) return err(errors.notFound({ guideId: input.guideId }))
    await context.db
      .insertInto('guide_excludes')
      .values({ id: createId(), guide_id: input.guideId, venue_id: input.venueId, created_at: Date.now() })
      .onConflict((oc) => oc.doNothing())
      .execute()
    return ok({})
  })

const removeGuideExclude = server
  .implement(removeGuideExcludeContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const guide = await context.db.selectFrom('guides').selectAll().where('id', '=', input.guideId).executeTakeFirst()
    if (!guide) return err(errors.notFound({ guideId: input.guideId }))
    await context.db
      .deleteFrom('guide_excludes')
      .where('guide_id', '=', input.guideId)
      .where('venue_id', '=', input.venueId)
      .execute()
    return ok({})
  })

/** Mobile-friendly HTML snapshot of the guide — the offline "keeping" artifact. */
const buildGuideEmailHtml = (view: NonNullable<Awaited<ReturnType<typeof loadGuideView>>>) => {
  const grouped = new Map<string, typeof view.venueRows>()
  for (const row of view.venueRows) {
    const list = grouped.get(row.venue.category) ?? []
    list.push(row)
    grouped.set(row.venue.category, list)
  }
  const sections = [...grouped.entries()]
    .map(
      ([category, rows]) => `
        <h2 style="font-size:18px;margin:28px 0 8px;color:#111">${category}</h2>
        ${rows
          .map(
            (r) => `
          <div style="margin:0 0 18px;padding:12px;border:1px solid #e2e2e2;border-radius:8px">
            <h3 style="margin:0 0 4px;font-size:16px">${r.venue.name}</h3>
            <p style="margin:0;color:#555;font-size:14px">${r.venue.address}${
              r.venue.openingHours ? ` · ${r.venue.openingHours}` : ''
            }</p>
            ${
              (r.overrideText ?? r.venue.note)
                ? `<p style="margin:6px 0 0;font-size:14px">${r.overrideText ?? r.venue.note}</p>`
                : ''
            }
          </div>`,
          )
          .join('\n')}
      `,
    )
    .join('\n')
  return `
<!doctype html><html><body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fafafa;color:#222">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <h1 style="font-size:22px">Your Reykjavík guide</h1>
    <p style="color:#555">Curated by Reykjavík Foodie — kept current, delivered to your inbox.</p>
    ${sections}
    <p style="margin-top:32px;color:#999;font-size:12px">Made for your stay · Reykjavík Foodie · rvkfoodie.is</p>
  </div>
</body></html>`
}

const requestGuideCapture = server
  .implement(requestGuideCaptureContract)
  .handler(async ({ input, errors, context }) => {
    const guide = await context.db.selectFrom('guides').selectAll().where('slug', '=', input.slug).executeTakeFirst()
    if (!guide) return err(errors.notFound({ guideId: input.slug }))
    const view = await loadGuideView(context.db, guide.id)
    if (!view) return err(errors.notFound({ guideId: input.slug }))

    // Bot protection (Turnstile) is punted — tracked in GitHub issue; the
    // capture endpoint is currently open. Revisit when spam is real.
    await context.db
      .insertInto('guide_captures')
      .values({
        id: createId(),
        guide_id: guide.id,
        email: input.email,
        created_at: Date.now(),
      })
      .execute()

    // beta ops (verified from-address, rate limit) land in ticket 07; local
    // emulation sends without them.
    const raw = [
      'From: Reykjavík Foodie <guides@rvkfoodie.is>',
      `To: <${input.email}>`,
      `Subject: Your Reykjavík guide (${guide.slug})`,
      `Message-ID: <${createId()}@rvkfoodie.is>`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      buildGuideEmailHtml(view),
    ].join('\r\n')
    try {
      await env.EMAIL.send(new EmailMessage('guides@rvkfoodie.is', input.email, raw))
    } catch (e) {
      console.error('capture email failed', e)
      return err(errors.notFound({ guideId: input.slug }))
    }
    return ok({})
  })

const loadGuideView = async (db: Db, guideId: string) => {
  const guide = await db.selectFrom('guides').selectAll().where('id', '=', guideId).executeTakeFirst()
  if (!guide) return null
  const rows = await db
    .selectFrom('guide_venues')
    .selectAll()
    .where('guide_id', '=', guideId)
    .where('status', '=', 'live')
    .orderBy('order_key', 'asc')
    .execute()
  const venueIds = rows.map((r) => r.venue_id)
  const venueRows = venueIds.length
    ? await db.selectFrom('venues').selectAll().where('id', 'in', venueIds).execute()
    : []
  const venueById = new Map(venueRows.map((v) => [v.id, v]))
  const venueRowsOut = rows.map((r) => {
    const venue = venueById.get(r.venue_id)!
    return {
      id: r.id,
      venueId: r.venue_id,
      orderKey: r.order_key,
      overrideText: r.override_text,
      pinned: r.pinned === 1,
      venue: venuePublic(decodeVenue(venue)),
    }
  })
  return { guide: decodeGuide(guide), venueRows: venueRowsOut }
}

const guideView = server.implement(guideViewContract).handler(async ({ input, errors, context }) => {
  const view = await loadGuideView(context.db, input.id)
  if (!view) return err(errors.notFound({ guideId: input.id }))
  return ok(view)
})

const guideViewBySlug = server
  .implement(guideViewBySlugContract)
  .handler(async ({ input, errors, context }) => {
    const guide = await context.db.selectFrom('guides').selectAll().where('slug', '=', input.slug).executeTakeFirst()
    if (!guide) return err(errors.notFound({ guideId: input.slug }))
    const view = await loadGuideView(context.db, guide.id)
    return ok(view!)
  })

const guideBuilder = server
  .implement(guideBuilderContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const guide = await context.db.selectFrom('guides').selectAll().where('id', '=', input.guideId).executeTakeFirst()
    if (!guide) return err(errors.notFound({ guideId: input.guideId }))
    const rows = await context.db
      .selectFrom('guide_venues')
      .selectAll()
      .where('guide_id', '=', input.guideId)
      .where('status', '!=', 'removed')
      .orderBy('order_key', 'asc')
      .execute()
    const venueIds = rows.map((r) => r.venue_id)
    const venueRows = venueIds.length
      ? await context.db.selectFrom('venues').selectAll().where('id', 'in', venueIds).execute()
      : []
    const venueById = new Map(venueRows.map((v) => [v.id, v]))
    const excludes = await context.db
      .selectFrom('guide_excludes')
      .leftJoin('venues', 'venues.id', 'guide_excludes.venue_id')
      .select(['guide_excludes.venue_id', 'venues.name'])
      .where('guide_excludes.guide_id', '=', input.guideId)
      .execute()
    return ok({
      guide: decodeGuide(guide),
      rows: rows
        .map((r) => {
          const venue = venueById.get(r.venue_id)
          if (!venue) return null
          return {
            id: r.id,
            venueId: r.venue_id,
            status: r.status,
            orderKey: r.order_key,
            overrideText: r.override_text,
            pinned: r.pinned === 1,
            // Exactly the picked fields — pick() rejects unknown properties.
            venue: {
              id: venue.id,
              name: venue.name,
              category: venue.category,
              address: venue.address,
              confidence: venue.confidence,
              photos: JSON.parse(venue.photos),
            },
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
      excludes: excludes.map((e) => ({ venueId: e.venue_id, name: e.name ?? '' })),
    })
  })

const sendDigestEmail = async (to: string, subject: string, text: string) => {
  const raw = [
    'From: Reykjavík Foodie <guides@rvkfoodie.is>',
    `To: <${to}>`,
    `Subject: ${subject}`,
    `Message-ID: <${crypto.randomUUID()}@rvkfoodie.is>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    text,
  ].join('\r\n')
  await env.EMAIL.send(new EmailMessage('guides@rvkfoodie.is', to, raw))
}

/**
 * The monthly-pass finish: diff each live guide against the last digest
 * baseline, email affected hotels. First run snapshots the baseline
 * silently (no mail). "removed" = closures (they drop on the next draft)
 * plus anything the hotel was told about that is no longer in the guide.
 */
const digestGuides = server
  .implement(digestContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const db = context.db
    const all = input.guideId
      ? await db.selectFrom('guides').selectAll().where('id', '=', input.guideId).execute()
      : await db.selectFrom('guides').selectAll().where('status', '=', 'live').execute()
    if (input.guideId && all.length === 0) return err(errors.notFound({ guideId: input.guideId }))

    const results = []
    for (const guide of all) {
      const rows = await db
        .selectFrom('guide_venues')
        .selectAll()
        .where('guide_id', '=', guide.id)
        .where('status', '=', 'live')
        .orderBy('order_key', 'asc')
        .execute()
      const venueRows = rows.length
        ? await db.selectFrom('venues').selectAll().where('id', 'in', rows.map((r) => r.venue_id)).execute()
        : []
      const venueById = new Map(venueRows.map((v) => [v.id, v]))

      const currentLive = rows
        .filter((r) => venueById.get(r.venue_id)?.status === 'live')
        .map((r) => r.venue_id)
      const closures = rows
        .filter((r) => venueById.get(r.venue_id)?.status !== 'live')
        .map((r) => r.venue_id)
      const baseline: string[] | null = guide.last_digest_venue_ids
        ? JSON.parse(guide.last_digest_venue_ids)
        : null

      let added: string[] = []
      let removed: string[] = []
      let skipped = baseline === null
      if (!skipped) {
        added = currentLive.filter((id) => !baseline!.includes(id))
        removed = [
          ...closures,
          ...baseline!.filter((id) => !currentLive.includes(id) && !closures.includes(id)),
        ]
      }

      const nameOf = (id: string) => venueById.get(id)?.name ?? id
      let emailed: string[] = []
      if (!skipped && (added.length > 0 || removed.length > 0)) {
        const hotel = await db.selectFrom('hotels').selectAll().where('id', '=', guide.hotel_id).executeTakeFirst()
        if (hotel) {
          const recipients = await db
            .selectFrom('contacts')
            .select(['email'])
            .where((eb) =>
              eb.and([
                eb.or([
                  eb('hotel_id', '=', hotel.id),
                  ...(hotel.business_id !== null ? [eb('business_id', '=', hotel.business_id)] : []),
                ]),
                eb('email', 'is not', null),
              ]),
            )
            .execute()
          const tos = recipients.map((r) => r.email).filter((e): e is string => e !== null)
          if (tos.length > 0) {
            const lines = [
              `Hi,`,
              ``,
              `Your Reykjavík Foodie guide (${guide.slug}) has been updated:`,
              ``,
              ...added.map((id) => `+ ${nameOf(id)}`),
              ...removed.map((id) => `- ${nameOf(id)}`),
              ``,
              `See it live: https://rvkfoodie.is/g/${guide.slug}`,
              ``,
              `— the Reykjavík Foodie editorial team`,
            ]
            for (const to of tos) {
              await sendDigestEmail(
                to,
                `Your guide — ${added.length} new, ${removed.length} removed`,
                lines.join('\n'),
              )
              emailed.push(to)
            }
          }
        }
      }

      await db
        .updateTable('guides')
        .set({
          last_digest_at: Date.now(),
          last_digest_venue_ids: toJson(currentLive),
          updated_at: Date.now(),
        })
        .where('id', '=', guide.id)
        .execute()
      await audit(db, {
        actor: context.session?.user.email ?? 'system',
        action: 'digest',
        entityType: 'guide',
        entityId: guide.id,
        after: { added, removed, emailed, skipped },
      })
      results.push({
        guideId: guide.id,
        slug: guide.slug,
        added: added.map(nameOf),
        removed: removed.map(nameOf),
        emailed,
        skipped,
      })
    }
    return ok(results)
  })

const updateGuideVenue = server
  .implement(updateGuideVenueContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const row = await context.db.selectFrom('guide_venues').selectAll().where('id', '=', input.id).executeTakeFirst()
    if (!row) return err(errors.notFound({ id: input.id }))
    const updated = await tryDb(() =>
      context.db
        .updateTable('guide_venues')
        .set({
          ...(input.orderKey !== undefined ? { order_key: input.orderKey } : {}),
          ...(input.pinned !== undefined ? { pinned: toBit(input.pinned) } : {}),
          ...(input.overrideText !== undefined ? { override_text: input.overrideText } : {}),
          updated_at: Date.now(),
        })
        .where('id', '=', input.id)
        .returningAll()
        .executeTakeFirstOrThrow(),
    )
    if (updated.isErr()) throw updated.error
    await audit(context.db, {
    actor: actorOf(context),
      action: 'guide-venue.update',
      entityType: 'guide',
      entityId: row.guide_id,
      after: {
        ...(input.orderKey !== undefined ? { orderKey: input.orderKey } : {}),
        ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
        ...(input.overrideText !== undefined ? { overrideText: input.overrideText } : {}),
      },
    })
    return ok(decodeGuideVenue(updated.value))
  })

export const router = server.router({
  venues: {
    feed: venueFeed,
    byId: venueById,
    add: addVenue,
    update: updateVenue,
    setStatus: setVenueStatus,
    addLifecycleEvent,
    listLifecycle,
  },
  venueAwards: {
    list: listAwards,
    add: addAward,
    remove: removeAward,
  },
  audit: { list: auditList },
  hotels: {
    list: hotelsList,
    listByBusiness: hotelsByBusiness,
    add: addHotel,
    update: updateHotel,
    remove: removeHotel,
    restore: restoreHotel,
  },
  businesses: {
    list: businessList,
    byId: businessById,
    add: addBusiness,
    update: updateBusiness,
    remove: removeBusiness,
    restore: restoreBusiness,
    summaries: businessDealSummaries,
  },
  contacts: {
    listByBusiness: contactsByBusiness,
    add: addContact,
    update: updateContact,
    remove: removeContact,
    restore: restoreContact,
  },
  deals: {
    listByBusiness: dealsByBusiness,
    add: addDeal,
    update: updateDeal,
    remove: removeDeal,
    restore: restoreDeal,
  },
  guides: {
    view: guideView,
    viewBySlug: guideViewBySlug,
    list: guideList,
    byId: guideById,
    create: createGuide,
    draft: draftGuide,
    approveCandidates: approveGuideCandidates,
    setConfig: setGuideConfig,
    publish: publishGuide,
    addExclude: addGuideExclude,
    removeExclude: removeGuideExclude,
    builder: guideBuilder,
    digest: digestGuides,
  },
  guideVenues: {
    update: updateGuideVenue,
  },
  captures: {
    request: requestGuideCapture,
  },
  events: {
    record: recordGuideEvent,
  },
  stats: { overview },
})

export const createContext = async ({
  request,
}: {
  request?: Request
} = {}): Promise<AppContext> => ({
  db,
  session: request ? await auth.api.getSession({ headers: request.headers }) : null,
})

/**
 * Mounted at POST /api/rpc by `src/routes/api.rpc.ts` (a TanStack Start
 * server route). Start's file-based server routes live under `/api`, so BOTH
 * ends are set explicitly — `endpoint` here and `fetchTransport({ url })` in
 * src/rpc-client.ts.
 */
export const rpcHandler = createFetchHandler({
  router,
  createContext,
  endpoint: '/api/rpc',
  onInternalError: (event) => {
    console.error('rpc internal', event.incidentId, event.cause)
  },
})
