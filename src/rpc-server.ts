/**
 * SERVER-ONLY: context shape, handlers, router, and the fetch-handler mount.
 * Closes over the Drizzle driver. Nothing in the browser graph may reach it —
 * the only importers are the `/api/rpc` server route and the createServerFn
 * prefetchers in ssr.ts, both of which Start strips from the client build.
 */
import { createId } from '@paralleldrive/cuid2'
import { and, asc, count, desc, eq, gt } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing'
import { err, matchError, ok } from 'result-rpc'
import { tryDb } from 'result-rpc/db'
import { createFetchHandler, serverRpc } from 'result-rpc/server'
import {
  addLifecycleEventContract,
  addVenueContract,
  auditListContract,
  hotelsListContract,
  listLifecycleContract,
  overviewContract,
  setVenueStatusContract,
  updateVenueContract,
  venueByIdContract,
  venueFeedContract,
} from './contract.js'
import { auditLog, db, hotels, venueLifecycleEvents, venues, type Db } from './db.js'

export interface AppContext {
  db: Db
}

const server = serverRpc.context<AppContext>()

const PAGE_SIZE = 50

/** Model rows carry extra columns (timestamps) — map to the exact model
 * shape so the wire encoder only ever sees declared fields. */
const toVenue = (row: typeof venues.$inferSelect) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  categorySecondary: row.categorySecondary,
  status: row.status,
  orderKey: row.orderKey,
  cuisine: row.cuisine,
  priceLevel: row.priceLevel,
  tags: row.tags,
  note: row.note,
  recommendedDishes: row.recommendedDishes,
  lastVerifiedAt: row.lastVerifiedAt,
  confidence: row.confidence,
  source: row.source,
  address: row.address,
  lat: row.lat,
  lon: row.lon,
  googlePlacesId: row.googlePlacesId,
  dineoutId: row.dineoutId,
  openingHours: row.openingHours,
  photos: row.photos,
})

const toHotel = (row: typeof hotels.$inferSelect) => ({
  id: row.id,
  name: row.name,
  roomCount: row.roomCount,
  pipelineStage: row.pipelineStage,
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
    await db.insert(auditLog).values({
      id: createId(),
      actor: entry.actor,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before === undefined ? null : JSON.stringify(entry.before),
      after: entry.after === undefined ? null : JSON.stringify(entry.after),
    })
  } catch {
    // audit is best-effort
  }
}

const venueFeed = server.implement(venueFeedContract).handler(async ({ input, context }) => {
  // input is `{ list: {}, cursor: string | null }` — the paginate split.
  // The feed is curated order: fractional-index orderKey, not id.
  const rows = await context.db
    .select()
    .from(venues)
    .where(input.cursor === null ? undefined : gt(venues.orderKey, input.cursor))
    .orderBy(asc(venues.orderKey))
    .limit(PAGE_SIZE + 1)
  const page = rows.slice(0, PAGE_SIZE)
  return ok({
    items: page.map(toVenue),
    nextCursor: rows.length > PAGE_SIZE ? (page[page.length - 1]?.orderKey ?? null) : null,
  })
})

const venueById = server.implement(venueByIdContract).handler(async ({ input, errors, context }) => {
  const row = (await context.db.select().from(venues).where(eq(venues.id, input.id)).limit(1))[0]
  if (!row) return err(errors.notFound({ venueId: input.id }))
  return ok(toVenue(row))
})

const addVenue = server.implement(addVenueContract).handler(async ({ input, errors, context }) => {
  const now = new Date()
  const last = (
    await context.db
      .select({ orderKey: venues.orderKey })
      .from(venues)
      .orderBy(desc(venues.orderKey))
      .limit(1)
  )[0]
  const row = {
    id: createId(),
    name: input.name,
    category: input.category,
    categorySecondary: input.categorySecondary ?? null,
    status: 'draft',
    orderKey: generateKeyBetween(last?.orderKey ?? null, null),
    cuisine: input.cuisine ?? null,
    priceLevel: input.priceLevel ?? null,
    tags: [],
    note: input.note ?? null,
    recommendedDishes: [],
    lastVerifiedAt: null,
    confidence: 0,
    source: 'editorial',
    address: input.address,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    googlePlacesId: input.googlePlacesId ?? null,
    dineoutId: input.dineoutId ?? null,
    openingHours: input.openingHours ?? null,
    photos: [],
    createdAt: now,
    updatedAt: now,
  }
  const inserted = await tryDb(context.db.insert(venues).values(row).returning())
  if (!inserted.ok) {
    return matchError(inserted.error, {
      'db/unique-violation': () => err(errors.nameTaken({ name: input.name })),
      'db/foreign-key-violation': (e) => {
        throw e
      },
      'db/not-null-violation': (e) => {
        throw e
      },
      'db/check-violation': (e) => {
        throw e
      },
      'db/query-failure': (e) => {
        throw e
      },
    })
  }
  await audit(context.db, {
    actor: 'system',
    action: 'create',
    entityType: 'venue',
    entityId: inserted.value[0]!.id,
    after: row,
  })
  return ok(toVenue(inserted.value[0]!))
})

const updateVenue = server.implement(updateVenueContract).handler(async ({ input, errors, context }) => {
  const before = (await context.db.select().from(venues).where(eq(venues.id, input.id)).limit(1))[0]
  if (!before) return err(errors.notFound({ venueId: input.id }))
  const set = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.categorySecondary !== undefined ? { categorySecondary: input.categorySecondary } : {}),
    ...(input.cuisine !== undefined ? { cuisine: input.cuisine } : {}),
    ...(input.priceLevel !== undefined ? { priceLevel: input.priceLevel } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.openingHours !== undefined ? { openingHours: input.openingHours } : {}),
    ...(input.dineoutId !== undefined ? { dineoutId: input.dineoutId } : {}),
    ...(input.googlePlacesId !== undefined ? { googlePlacesId: input.googlePlacesId } : {}),
    ...(input.lat !== undefined ? { lat: input.lat } : {}),
    ...(input.lon !== undefined ? { lon: input.lon } : {}),
    ...(input.tags !== undefined ? { tags: [...input.tags] } : {}),
    ...(input.recommendedDishes !== undefined ? { recommendedDishes: [...input.recommendedDishes] } : {}),
    ...(input.photos !== undefined ? { photos: [...input.photos] } : {}),
    updatedAt: new Date(),
  }
  const updated = await tryDb(
    context.db.update(venues).set(set).where(eq(venues.id, input.id)).returning(),
  )
  if (!updated.ok) {
    return matchError(updated.error, {
      'db/unique-violation': () => err(errors.nameTaken({ name: input.name ?? before.name })),
      'db/foreign-key-violation': (e) => {
        throw e
      },
      'db/not-null-violation': (e) => {
        throw e
      },
      'db/check-violation': (e) => {
        throw e
      },
      'db/query-failure': (e) => {
        throw e
      },
    })
  }
  const afterRow = updated.value[0]!
  await audit(context.db, {
    actor: 'system',
    action: 'update',
    entityType: 'venue',
    entityId: afterRow.id,
    before: before,
    after: afterRow,
  })
  return ok(toVenue(afterRow))
})

const setVenueStatus = server
  .implement(setVenueStatusContract)
  .handler(async ({ input, errors, context }) => {
    const before = (await context.db.select().from(venues).where(eq(venues.id, input.id)).limit(1))[0]
    if (!before) return err(errors.notFound({ venueId: input.id }))
    const updated = (
      await context.db
        .update(venues)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(venues.id, input.id))
        .returning()
    )[0]
    await audit(context.db, {
      actor: 'system',
      action: 'status-change',
      entityType: 'venue',
      entityId: input.id,
      before: { status: before.status },
      after: { status: input.status },
    })
    return ok(toVenue(updated!))
  })

const addLifecycleEvent = server
  .implement(addLifecycleEventContract)
  .handler(async ({ input, errors, context }) => {
    const venue = (
      await context.db.select().from(venues).where(eq(venues.id, input.venueId)).limit(1)
    )[0]
    if (!venue) return err(errors.notFound({ venueId: input.venueId }))

    // The lifecycle event mechanically drives venue status + confidence:
    // closure → status closed, confidence 0; reopened → status live.
    if (input.type === 'closed' || input.type === 'temporarily-closed') {
      await context.db
        .update(venues)
        .set({ status: 'closed', confidence: 0, updatedAt: new Date() })
        .where(eq(venues.id, input.venueId))
    } else {
      await context.db
        .update(venues)
        .set({ status: 'live', updatedAt: new Date() })
        .where(eq(venues.id, input.venueId))
    }

    const row = {
      id: createId(),
      venueId: input.venueId,
      type: input.type,
      startedAt: input.startedAt,
      endedAt: null,
      note: input.note ?? null,
      createdAt: new Date(),
    }
    await context.db.insert(venueLifecycleEvents).values(row)
    await audit(context.db, {
      actor: 'system',
      action: 'lifecycle',
      entityType: 'venue',
      entityId: input.venueId,
      after: { type: input.type, startedAt: input.startedAt },
    })
    return ok(row)
  })

const listLifecycle = server.implement(listLifecycleContract).handler(async ({ input, context }) => {
  const rows = await context.db
    .select()
    .from(venueLifecycleEvents)
    .where(eq(venueLifecycleEvents.venueId, input.venueId))
    .orderBy(desc(venueLifecycleEvents.startedAt))
  return ok(rows)
})

const auditList = server.implement(auditListContract).handler(async ({ input, context }) => {
  const rows = await context.db
    .select()
    .from(auditLog)
    .where(
      and(eq(auditLog.entityType, input.entityType), eq(auditLog.entityId, input.entityId)),
    )
    .orderBy(desc(auditLog.at))
    .limit(50)
  return ok(rows)
})

const hotelsList = server.implement(hotelsListContract).handler(async ({ context }) => {
  const rows = await context.db.select().from(hotels).orderBy(asc(hotels.name))
  return ok(rows.map(toHotel))
})

const overview = server.implement(overviewContract).handler(async ({ context }) => {
  const venueCount = (await context.db.select({ n: count() }).from(venues))[0]!.n
  const liveVenueCount = (
    await context.db.select({ n: count() }).from(venues).where(eq(venues.status, 'live'))
  )[0]!.n
  const hotelCount = (await context.db.select({ n: count() }).from(hotels))[0]!.n
  return ok({ venueCount, liveVenueCount, hotelCount })
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
  audit: { list: auditList },
  hotels: { list: hotelsList },
  stats: { overview },
})

export const createContext = (): AppContext => ({ db })

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
  contractVersion: 'rvkfoodie-scaffold',
})
