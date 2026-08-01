/**
 * SERVER-ONLY: context shape, handlers, router, and the fetch-handler mount.
 * Closes over the Drizzle driver. Nothing in the browser graph may reach it —
 * the only importers are the `/api/rpc` server route and the createServerFn
 * prefetchers in ssr.ts, both of which Start strips from the client build.
 */
import { createId } from '@paralleldrive/cuid2'
import { and, asc, count, desc, eq, gt, sum } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing'
import { err, matchError, ok } from 'result-rpc'
import { tryDb } from 'result-rpc/db'
import { createFetchHandler, serverRpc } from 'result-rpc/server'
import {
  addBusinessContract,
  addContactContract,
  addDealContract,
  addHotelContract,
  addLifecycleEventContract,
  addVenueContract,
  auditListContract,
  businessByIdContract,
  businessListContract,
  contactsByBusinessContract,
  dealsByBusinessContract,
  hotelsByBusinessContract,
  hotelsListContract,
  listLifecycleContract,
  overviewContract,
  setVenueStatusContract,
  updateBusinessContract,
  updateContactContract,
  updateDealContract,
  updateHotelContract,
  updateVenueContract,
  venueByIdContract,
  venueFeedContract,
} from './contract.js'
import {
  auditLog,
  businesses,
  contacts,
  db,
  deals,
  hotels,
  venueLifecycleEvents,
  venues,
  type Db,
} from './db.js'

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
  businessId: row.businessId,
  name: row.name,
  address: row.address,
  lat: row.lat,
  lon: row.lon,
  roomCount: row.roomCount,
  website: row.website,
})

const toBusiness = (row: typeof businesses.$inferSelect) => ({
  id: row.id,
  name: row.name,
  website: row.website,
  industry: row.industry,
  notes: row.notes,
})

const toContact = (row: typeof contacts.$inferSelect) => ({
  id: row.id,
  businessId: row.businessId,
  hotelId: row.hotelId,
  firstName: row.firstName,
  lastName: row.lastName,
  email: row.email,
  phone: row.phone,
  title: row.title,
  isDecisionMaker: row.isDecisionMaker,
})

const toDeal = (row: typeof deals.$inferSelect) => ({
  id: row.id,
  businessId: row.businessId,
  name: row.name,
  stage: row.stage,
  pricePerRoom: row.pricePerRoom,
  annualValue: row.annualValue,
  startDate: row.startDate,
  renewalDate: row.renewalDate,
  notes: row.notes,
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

const hotelsByBusiness = server
  .implement(hotelsByBusinessContract)
  .handler(async ({ input, context }) => {
    const rows = await context.db
      .select()
      .from(hotels)
      .where(eq(hotels.businessId, input.businessId))
      .orderBy(asc(hotels.name))
    return ok(rows.map(toHotel))
  })

const addHotel = server
  .implement(addHotelContract)
  .handler(async ({ input, errors, context }) => {
  const now = new Date()
  const row = {
    id: createId(),
    businessId: input.businessId ?? null,
    name: input.name,
    address: input.address ?? null,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    roomCount: input.roomCount ?? 0,
    website: input.website ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }
  const inserted = await tryDb(context.db.insert(hotels).values(row).returning())
  if (!inserted.ok) {
    return matchError(inserted.error, {
      'db/unique-violation': () => err(errors.notFound({ hotelId: input.name })),
      'db/foreign-key-violation': () => err(errors.notFound({ hotelId: input.businessId ?? '' })),
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
    entityType: 'hotel',
    entityId: inserted.value[0]!.id,
    after: row,
  })
  return ok(toHotel(inserted.value[0]!))
})

const updateHotel = server.implement(updateHotelContract).handler(async ({ input, errors, context }) => {
  const before = (await context.db.select().from(hotels).where(eq(hotels.id, input.id)).limit(1))[0]
  if (!before) return err(errors.notFound({ hotelId: input.id }))
  const set = {
    ...(input.businessId !== undefined ? { businessId: input.businessId } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.lat !== undefined ? { lat: input.lat } : {}),
    ...(input.lon !== undefined ? { lon: input.lon } : {}),
    ...(input.roomCount !== undefined ? { roomCount: input.roomCount } : {}),
    ...(input.website !== undefined ? { website: input.website } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    updatedAt: new Date(),
  }
  const updated = await tryDb(
    context.db.update(hotels).set(set).where(eq(hotels.id, input.id)).returning(),
  )
  if (!updated.ok) {
    return matchError(updated.error, {
      'db/unique-violation': () => err(errors.notFound({ hotelId: input.name ?? before.name })),
      'db/foreign-key-violation': () => err(errors.notFound({ hotelId: input.businessId ?? '' })),
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
    entityType: 'hotel',
    entityId: afterRow.id,
    before,
    after: afterRow,
  })
  return ok(toHotel(afterRow))
})

// --- CRM handlers ---------------------------------------------------------

const businessList = server.implement(businessListContract).handler(async ({ context }) => {
  const rows = await context.db.select().from(businesses).orderBy(asc(businesses.name))
  return ok(rows.map(toBusiness))
})

const businessById = server
  .implement(businessByIdContract)
  .handler(async ({ input, errors, context }) => {
    const row = (
      await context.db.select().from(businesses).where(eq(businesses.id, input.id)).limit(1)
    )[0]
    if (!row) return err(errors.notFound({ businessId: input.id }))
    return ok(toBusiness(row))
  })

const addBusiness = server
  .implement(addBusinessContract)
  .handler(async ({ input, errors, context }) => {
    const now = new Date()
    const row = {
      id: createId(),
      name: input.name,
      website: input.website ?? null,
      industry: input.industry ?? null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    }
    const inserted = await tryDb(context.db.insert(businesses).values(row).returning())
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
      entityType: 'business',
      entityId: inserted.value[0]!.id,
      after: row,
    })
    return ok(toBusiness(inserted.value[0]!))
  })

const updateBusiness = server
  .implement(updateBusinessContract)
  .handler(async ({ input, errors, context }) => {
    const before = (
      await context.db.select().from(businesses).where(eq(businesses.id, input.id)).limit(1)
    )[0]
    if (!before) return err(errors.notFound({ businessId: input.id }))
    const set = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.industry !== undefined ? { industry: input.industry } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
    }
    const updated = await tryDb(
      context.db.update(businesses).set(set).where(eq(businesses.id, input.id)).returning(),
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
      entityType: 'business',
      entityId: afterRow.id,
      before,
      after: afterRow,
    })
    return ok(toBusiness(afterRow))
  })

const contactsByBusiness = server
  .implement(contactsByBusinessContract)
  .handler(async ({ input, context }) => {
    const rows = await context.db
      .select()
      .from(contacts)
      .where(eq(contacts.businessId, input.businessId))
      .orderBy(asc(contacts.lastName), asc(contacts.firstName))
    return ok(rows.map(toContact))
  })

const addContact = server
  .implement(addContactContract)
  .handler(async ({ input, errors, context }) => {
  const now = new Date()
  const row = {
    id: createId(),
    businessId: input.businessId,
    hotelId: input.hotelId ?? null,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    title: input.title ?? null,
    isDecisionMaker: input.isDecisionMaker ?? false,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }
  const inserted = await tryDb(context.db.insert(contacts).values(row).returning())
  if (!inserted.ok) {
    return matchError(inserted.error, {
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
      'db/unique-violation': (e) => {
        throw e
      },
    })
  }
  await audit(context.db, {
    actor: 'system',
    action: 'create',
    entityType: 'contact',
    entityId: inserted.value[0]!.id,
    after: row,
  })
  return ok(toContact(inserted.value[0]!))
})

const updateContact = server
  .implement(updateContactContract)
  .handler(async ({ input, errors, context }) => {
    const before = (await context.db.select().from(contacts).where(eq(contacts.id, input.id)).limit(1))[0]
    if (!before) return err(errors.notFound({ contactId: input.id }))
    const set = {
      ...(input.hotelId !== undefined ? { hotelId: input.hotelId } : {}),
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.isDecisionMaker !== undefined ? { isDecisionMaker: input.isDecisionMaker } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
    }
    const updated = (
      await context.db.update(contacts).set(set).where(eq(contacts.id, input.id)).returning()
    )[0]
    await audit(context.db, {
      actor: 'system',
      action: 'update',
      entityType: 'contact',
      entityId: input.id,
      before,
      after: updated,
    })
    return ok(toContact(updated!))
  })

const dealsByBusiness = server
  .implement(dealsByBusinessContract)
  .handler(async ({ input, context }) => {
    const rows = await context.db
      .select()
      .from(deals)
      .where(eq(deals.businessId, input.businessId))
      .orderBy(desc(deals.updatedAt))
    return ok(rows.map(toDeal))
  })

/** annualValue = pricePerRoom × total rooms across the business's hotels. */
const computedAnnualValue = async (db: Db, businessId: string, pricePerRoom: number) => {
  const total = (
    await db
      .select({ n: sum(hotels.roomCount) })
      .from(hotels)
      .where(eq(hotels.businessId, businessId))
  )[0]!.n
  return pricePerRoom * Number(total ?? 0)
}

const addDeal = server
  .implement(addDealContract)
  .handler(async ({ input, errors, context }) => {
  const now = new Date()
  const annualValue =
    input.annualValue ??
    (input.pricePerRoom !== undefined
      ? await computedAnnualValue(context.db, input.businessId, input.pricePerRoom)
      : undefined)
  const row = {
    id: createId(),
    businessId: input.businessId,
    name: input.name,
    stage: input.stage ?? 'prospect',
    pricePerRoom: input.pricePerRoom ?? null,
    annualValue: annualValue ?? null,
    startDate: input.startDate ?? null,
    renewalDate: input.renewalDate ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }
  const inserted = await tryDb(context.db.insert(deals).values(row).returning())
  if (!inserted.ok) {
    return matchError(inserted.error, {
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
      'db/unique-violation': (e) => {
        throw e
      },
    })
  }
  await audit(context.db, {
    actor: 'system',
    action: 'create',
    entityType: 'deal',
    entityId: inserted.value[0]!.id,
    after: row,
  })
  return ok(toDeal(inserted.value[0]!))
})

const updateDeal = server.implement(updateDealContract).handler(async ({ input, errors, context }) => {
  const before = (await context.db.select().from(deals).where(eq(deals.id, input.id)).limit(1))[0]
  if (!before) return err(errors.notFound({ dealId: input.id }))
  const annualValue =
    input.annualValue ??
    (input.pricePerRoom !== undefined
      ? await computedAnnualValue(context.db, before.businessId, input.pricePerRoom)
      : undefined)
  const set = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.stage !== undefined ? { stage: input.stage } : {}),
    ...(input.pricePerRoom !== undefined ? { pricePerRoom: input.pricePerRoom } : {}),
    ...(annualValue !== undefined ? { annualValue } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.renewalDate !== undefined ? { renewalDate: input.renewalDate } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    updatedAt: new Date(),
  }
  const updated = (
    await context.db.update(deals).set(set).where(eq(deals.id, input.id)).returning()
  )[0]
  await audit(context.db, {
    actor: 'system',
    action: 'update',
    entityType: 'deal',
    entityId: input.id,
    before,
    after: updated,
  })
  return ok(toDeal(updated!))
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
  hotels: {
    list: hotelsList,
    listByBusiness: hotelsByBusiness,
    add: addHotel,
    update: updateHotel,
  },
  businesses: {
    list: businessList,
    byId: businessById,
    add: addBusiness,
    update: updateBusiness,
  },
  contacts: {
    listByBusiness: contactsByBusiness,
    add: addContact,
    update: updateContact,
  },
  deals: {
    listByBusiness: dealsByBusiness,
    add: addDeal,
    update: updateDeal,
  },
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
