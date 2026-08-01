/**
 * SERVER-ONLY: context shape, handlers, router, and the fetch-handler mount.
 * This module closes over the Drizzle driver. Nothing in the browser graph
 * may reach it — the only importers are the `/api/rpc` server route and the
 * `createServerFn` prefetchers in ssr.ts, both of which Start strips from
 * the client build.
 */
import { createId } from '@paralleldrive/cuid2'
import { asc, count, desc, eq, gt } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing'
import { err, matchError, ok } from 'result-rpc'
import { tryDb } from 'result-rpc/db'
import { createFetchHandler, serverRpc } from 'result-rpc/server'
import {
  addVenueContract,
  hotelsListContract,
  overviewContract,
  setVenueStatusContract,
  venueByIdContract,
  venueFeedContract,
} from './contract.js'
import { db, hotels, venues, type Db } from './db.js'

export interface AppContext {
  db: Db
}

const server = serverRpc.context<AppContext>()

const PAGE_SIZE = 50

/** Model rows carry extra columns (notes, timestamps) — map to the exact
 * model shape so the wire encoder only ever sees declared fields. */
const toVenue = (row: typeof venues.$inferSelect) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  neighborhood: row.neighborhood,
  status: row.status,
  orderKey: row.orderKey,
})

const toHotel = (row: typeof hotels.$inferSelect) => ({
  id: row.id,
  name: row.name,
  roomCount: row.roomCount,
  pipelineStage: row.pipelineStage,
})

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
  // CUID2 id, generated server-side; orderKey appended after the current
  // last venue (client-first reordering arrives with the guide builder).
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
    neighborhood: input.neighborhood,
    status: 'draft',
    orderKey: generateKeyBetween(last?.orderKey ?? null, null),
    notes: null,
    createdAt: now,
    updatedAt: now,
  }
  // Attempting the insert IS the uniqueness check — `tryDb` turns the
  // constraint outcome into a Result instead of a thrown driver error.
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
  return ok(toVenue(inserted.value[0]!))
})

const setVenueStatus = server
  .implement(setVenueStatusContract)
  .handler(async ({ input, errors, context }) => {
    const updated = (
      await context.db
        .update(venues)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(venues.id, input.id))
        .returning()
    )[0]
    if (!updated) return err(errors.notFound({ venueId: input.id }))
    return ok(toVenue(updated))
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
  venues: { feed: venueFeed, byId: venueById, add: addVenue, setStatus: setVenueStatus },
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
