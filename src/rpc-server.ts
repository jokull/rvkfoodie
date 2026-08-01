/**
 * SERVER-ONLY: context shape, handlers, router, and the fetch-handler mount.
 * Closes over the Drizzle driver. Nothing in the browser graph may reach it —
 * the only importers are the `/api/rpc` server route and the createServerFn
 * prefetchers in ssr.ts, both of which Start strips from the client build.
 */
import { createId } from '@paralleldrive/cuid2'
import { env } from 'cloudflare:workers'
import { EmailMessage } from 'cloudflare:email'
import { and, asc, count, desc, eq, gt, inArray, ne, sum } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing'
import { err, matchError, ok, pickErrors } from 'result-rpc'
import { tryDb } from 'result-rpc/db'
import { createFetchHandler, serverRpc } from 'result-rpc/server'
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
  removeGuideExcludeContract,
  requestGuideCaptureContract,
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
} from './contract.js'
import {
  auditLog,
  businesses,
  contacts,
  db,
  deals,
  guideCaptures,
  guideEvents,
  guideExcludes,
  guideVenues,
  guides,
  hotels,
  venueAwards,
  venueLifecycleEvents,
  venues,
  type Db,
} from './db.js'
import { draftItinerary } from './guide-gen.js'
import { VENUE_AWARD_TYPES } from './schema.js'
import { auth } from './auth.js'
import { authErrors, guideVenueErrors } from './errors.js'

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
    if (!context.session) return err(errors.unauthorized({}))
    return next({ context: {} })
  })

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
  website: row.website,
  phone: row.phone,
  openingHours: row.openingHours,
  photos: row.photos,
  createdAt: row.createdAt,
})

/** Exactly the fields the public guide view exposes (Venue.pick). */
const toVenuePublic = (row: typeof venues.$inferSelect) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  categorySecondary: row.categorySecondary,
  address: row.address,
  openingHours: row.openingHours,
  note: row.note,
  recommendedDishes: row.recommendedDishes,
  dineoutId: row.dineoutId,
  website: row.website,
  phone: row.phone,
  lat: row.lat,
  lon: row.lon,
  confidence: row.confidence,
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

const toGuide = (row: typeof guides.$inferSelect) => ({
  id: row.id,
  hotelId: row.hotelId,
  slug: row.slug,
  status: row.status,
  radiusMin: row.radiusMin,
  targetCount: row.targetCount,
  generatedAt: row.generatedAt,
})

const toGuideVenue = (row: typeof guideVenues.$inferSelect) => ({
  id: row.id,
  guideId: row.guideId,
  venueId: row.venueId,
  status: row.status,
  orderKey: row.orderKey,
  overrideText: row.overrideText,
  pinned: row.pinned,
})

const toLifecycle = (row: typeof venueLifecycleEvents.$inferSelect) => ({
  id: row.id,
  venueId: row.venueId,
  type: row.type,
  startedAt: row.startedAt,
  endedAt: row.endedAt,
  note: row.note,
})

const toAward = (row: typeof venueAwards.$inferSelect) => ({
  id: row.id,
  venueId: row.venueId,
  awardType: row.awardType,
  title: row.title,
  url: row.url,
  createdAt: row.createdAt,
})

const slugFromName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

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

const addVenue = server.implement(addVenueContract).use(requireStaff).handler(async ({ input, errors, context }) => {
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
    website: input.website ?? null,
    phone: input.phone ?? null,
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

const updateVenue = server.implement(updateVenueContract).use(requireStaff).handler(async ({ input, errors, context }) => {
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
    ...(input.website !== undefined ? { website: input.website } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
    ...(input.lastVerifiedAt !== undefined ? { lastVerifiedAt: input.lastVerifiedAt } : {}),
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
  .implement(setVenueStatusContract).use(requireStaff)
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
  .implement(addLifecycleEventContract).use(requireStaff)
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
    return ok(toLifecycle(row))
  })

const listLifecycle = server.implement(listLifecycleContract).handler(async ({ input, context }) => {
  const rows = await context.db
    .select()
    .from(venueLifecycleEvents)
    .where(eq(venueLifecycleEvents.venueId, input.venueId))
    .orderBy(desc(venueLifecycleEvents.startedAt))
  return ok(rows.map(toLifecycle))
})

const listAwards = server.implement(venueAwardListContract).handler(async ({ input, errors, context }) => {
  const venue = (await context.db.select().from(venues).where(eq(venues.id, input.venueId)).limit(1))[0]
  if (!venue) return err(errors.notFound({ venueId: input.venueId }))
  const rows = await context.db
    .select()
    .from(venueAwards)
    .where(eq(venueAwards.venueId, input.venueId))
    .orderBy(desc(venueAwards.createdAt))
  return ok(rows.map(toAward))
})

const addAward = server.implement(venueAwardAddContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const venue = (await context.db.select().from(venues).where(eq(venues.id, input.venueId)).limit(1))[0]
  if (!venue) return err(errors.notFound({ venueId: input.venueId }))
  const inserted = await tryDb(
    context.db
      .insert(venueAwards)
      .values({
        id: createId(),
        venueId: input.venueId,
        awardType: input.awardType as (typeof VENUE_AWARD_TYPES)[number],
        title: input.title,
        url: input.url ?? null,
        createdAt: new Date(),
      })
      .returning(),
  )
  if (!inserted.ok) {
    return matchError(inserted.error, {
      'db/unique-violation': () => err(errors.exists({ venueId: input.venueId })),
      'db/foreign-key-violation': (e) => {
        throw e
      },
      'db/query-failure': (e) => {
        throw e
      },
      'db/not-null-violation': (e) => {
        throw e
      },
      'db/check-violation': (e) => {
        throw e
      },
    })
  }
  await audit(context.db, {
    actor: 'staff',
    action: 'venue.award.add',
    entityType: 'venue',
    entityId: input.venueId,
    after: { awardType: input.awardType, title: input.title, url: input.url ?? null },
  })
  return ok(toAward(inserted.value[0]!))
})

const removeAward = server.implement(venueAwardRemoveContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const deleted = await context.db.delete(venueAwards).where(eq(venueAwards.id, input.id)).returning()
  const row = deleted[0]
  if (!row) return err(errors.notFound({ awardId: input.id }))
  await audit(context.db, {
    actor: 'staff',
    action: 'venue.award.remove',
    entityType: 'venue',
    entityId: row.venueId,
    before: { awardType: row.awardType, title: row.title },
  })
  return ok({ removed: true })
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
  .implement(addHotelContract).use(requireStaff)
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

const updateHotel = server.implement(updateHotelContract).use(requireStaff).handler(async ({ input, errors, context }) => {
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
  .implement(addBusinessContract).use(requireStaff)
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
  .implement(updateBusinessContract).use(requireStaff)
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
  .implement(addContactContract).use(requireStaff)
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
  .implement(updateContactContract).use(requireStaff)
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
  .implement(addDealContract).use(requireStaff)
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

const updateDeal = server.implement(updateDealContract).use(requireStaff).handler(async ({ input, errors, context }) => {
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

/** Fire-and-forget: drop silently if the guide is missing. */
const recordGuideEvent = server
  .implement(recordGuideEventContract)
  .handler(async ({ input, context }) => {
    const guide = (
      await context.db.select().from(guides).where(eq(guides.slug, input.slug)).limit(1)
    )[0]
    if (!guide) return ok({})
    await context.db.insert(guideEvents).values({
      id: createId(),
      guideId: guide.id,
      event: input.event,
      venueId: input.venueId ?? null,
      happenedAt: new Date(),
    })
    return ok({})
  })

// --- Guide handlers -------------------------------------------------------

const guideList = server.implement(guideListContract).handler(async ({ context }) => {
  const rows = await context.db.select().from(guides).orderBy(asc(guides.slug))
  return ok(rows.map(toGuide))
})

const guideById = server.implement(guideByIdContract).handler(async ({ input, errors, context }) => {
  const row = (await context.db.select().from(guides).where(eq(guides.id, input.id)).limit(1))[0]
  if (!row) return err(errors.notFound({ guideId: input.id }))
  return ok(toGuide(row))
})

const createGuide = server.implement(createGuideContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const hotel = (await context.db.select().from(hotels).where(eq(hotels.id, input.hotelId)).limit(1))[0]
  if (!hotel) return err(errors.notFound({ guideId: input.hotelId }))
  const existing = (
    await context.db.select().from(guides).where(eq(guides.hotelId, input.hotelId)).limit(1)
  )[0]
  if (existing) return ok(toGuide(existing))
  const row = {
    id: createId(),
    hotelId: input.hotelId,
    slug: slugFromName(hotel.name),
    status: 'draft',
    radiusMin: input.radiusMin ?? 20,
    targetCount: input.targetCount ?? 24,
    generatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const inserted = await context.db.insert(guides).values(row).returning()
  await audit(context.db, {
    actor: 'system',
    action: 'create',
    entityType: 'guide',
    entityId: inserted[0]!.id,
    after: row,
  })
  return ok(toGuide(inserted[0]!))
})

const draftGuide = server.implement(draftGuideContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const guide = (await context.db.select().from(guides).where(eq(guides.id, input.id)).limit(1))[0]
  if (!guide) return err(errors.notFound({ guideId: input.id }))
  const hotel = (await context.db.select().from(hotels).where(eq(hotels.id, guide.hotelId)).limit(1))[0]
  if (!hotel || hotel.lat === null || hotel.lon === null) {
    return err(errors.noPool({ guideId: input.id }))
  }

  const excluded = (
    await context.db
      .select({ venueId: guideExcludes.venueId })
      .from(guideExcludes)
      .where(eq(guideExcludes.guideId, input.id))
  ).map((r) => r.venueId)
  const excludedIds = new Set(excluded)

  const existingRows = await context.db
    .select()
    .from(guideVenues)
    .where(and(eq(guideVenues.guideId, input.id), ne(guideVenues.status, 'removed')))
  const existingIds = existingRows.map((r) => r.venueId)
  const venueStatus = new Map<string, string>()
  if (existingIds.length > 0) {
    const vs = await context.db
      .select({ id: venues.id, status: venues.status })
      .from(venues)
      .where(inArray(venues.id, existingIds))
    for (const v of vs) venueStatus.set(v.id, v.status)
  }

  // Merge: keep qualifying rows in place (status-only silent disqualifier);
  // closed venues are marked removed.
  const kept: string[] = []
  const dropped: string[] = []
  let lastOrderKey: string | null = null
  const now = new Date()
  for (const row of existingRows) {
    if (venueStatus.get(row.venueId) === 'live') {
      kept.push(row.venueId)
      if (lastOrderKey === null || row.orderKey > lastOrderKey) lastOrderKey = row.orderKey
    } else {
      dropped.push(row.venueId)
      await context.db
        .update(guideVenues)
        .set({ status: 'removed', updatedAt: now })
        .where(eq(guideVenues.id, row.id))
    }
  }

  // Pool: live venues, not already in the guide, not excluded, with coords.
  const poolRows = await context.db
    .select({
      id: venues.id,
      category: venues.category,
      lat: venues.lat,
      lon: venues.lon,
      confidence: venues.confidence,
    })
    .from(venues)
    .where(eq(venues.status, 'live'))
  const pool = poolRows.filter(
    (v) => !excludedIds.has(v.id) && !new Set([...kept, ...dropped]).has(v.id),
  )

  const picks = draftItinerary({
    hotel: { lat: hotel.lat, lon: hotel.lon },
    radiusMin: guide.radiusMin,
    targetCount: guide.targetCount,
    pool,
    lastOrderKey,
  })
  for (const pick of picks) {
    await context.db.insert(guideVenues).values({
      id: createId(),
      guideId: input.id,
      venueId: pick.venueId,
      status: 'pending',
      orderKey: pick.orderKey,
      overrideText: null,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    })
  }
  await context.db
    .update(guides)
    .set({ generatedAt: now, updatedAt: now })
    .where(eq(guides.id, input.id))
  await audit(context.db, {
    actor: 'system',
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
    const guide = (
      await context.db.select().from(guides).where(eq(guides.id, input.guideId)).limit(1)
    )[0]
    if (!guide) return err(errors.notFound({ guideId: input.guideId }))
    const rows = await context.db
      .select()
      .from(guideVenues)
      .where(
        and(
          eq(guideVenues.guideId, input.guideId),
          eq(guideVenues.status, 'pending'),
          inArray(guideVenues.venueId, input.venueIds),
        ),
      )
    const now = new Date()
    for (const row of rows) {
      await context.db
        .update(guideVenues)
        .set({ status: 'live', updatedAt: now })
        .where(eq(guideVenues.id, row.id))
    }
    await audit(context.db, {
      actor: 'system',
      action: 'approve-candidates',
      entityType: 'guide',
      entityId: input.guideId,
      after: { venueIds: input.venueIds },
    })
    return ok(rows.map(toGuideVenue))
  })

const setGuideConfig = server
  .implement(setGuideConfigContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const guide = (
      await context.db.select().from(guides).where(eq(guides.id, input.guideId)).limit(1)
    )[0]
    if (!guide) return err(errors.notFound({ guideId: input.guideId }))
    const updated = (
      await context.db
        .update(guides)
        .set({
          ...(input.radiusMin !== undefined ? { radiusMin: input.radiusMin } : {}),
          ...(input.targetCount !== undefined ? { targetCount: input.targetCount } : {}),
          updatedAt: new Date(),
        })
        .where(eq(guides.id, input.guideId))
        .returning()
    )[0]
    await audit(context.db, {
      actor: 'system',
      action: 'config-change',
      entityType: 'guide',
      entityId: input.guideId,
      before: { radiusMin: guide.radiusMin, targetCount: guide.targetCount },
      after: { radiusMin: updated!.radiusMin, targetCount: updated!.targetCount },
    })
    return ok(toGuide(updated!))
  })

const publishGuide = server.implement(publishGuideContract).use(requireStaff).handler(async ({ input, errors, context }) => {
  const guide = (await context.db.select().from(guides).where(eq(guides.id, input.id)).limit(1))[0]
  if (!guide) return err(errors.notFound({ guideId: input.id }))
  const updated = (
    await context.db
      .update(guides)
      .set({ status: 'live', updatedAt: new Date() })
      .where(eq(guides.id, input.id))
      .returning()
  )[0]
  await audit(context.db, {
    actor: 'system',
    action: 'publish',
    entityType: 'guide',
    entityId: input.id,
    before: { status: guide.status },
    after: { status: 'live' },
  })
  return ok(toGuide(updated!))
})

const addGuideExclude = server
  .implement(addGuideExcludeContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const guide = (
      await context.db.select().from(guides).where(eq(guides.id, input.guideId)).limit(1)
    )[0]
    if (!guide) return err(errors.notFound({ guideId: input.guideId }))
    await context.db
      .insert(guideExcludes)
      .values({ id: createId(), guideId: input.guideId, venueId: input.venueId })
      .onConflictDoNothing()
    return ok({})
  })

const removeGuideExclude = server
  .implement(removeGuideExcludeContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const guide = (
      await context.db.select().from(guides).where(eq(guides.id, input.guideId)).limit(1)
    )[0]
    if (!guide) return err(errors.notFound({ guideId: input.guideId }))
    await context.db
      .delete(guideExcludes)
      .where(
        and(eq(guideExcludes.guideId, input.guideId), eq(guideExcludes.venueId, input.venueId)),
      )
    return ok({})
  })

/** Mobile-friendly HTML snapshot of the guide — the offline “keeping” artifact. */
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
    const guide = (
      await context.db.select().from(guides).where(eq(guides.slug, input.slug)).limit(1)
    )[0]
    if (!guide) return err(errors.notFound({ guideId: input.slug }))
    const view = await loadGuideView(context.db, guide.id)
    if (!view) return err(errors.notFound({ guideId: input.slug }))

    // Bot protection (Turnstile) is punted — tracked in GitHub issue; the
    // capture endpoint is currently open. Revisit when spam is real.
    await context.db.insert(guideCaptures).values({
      id: createId(),
      guideId: guide.id,
      email: input.email,
      createdAt: new Date(),
    })

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
  const guide = (await db.select().from(guides).where(eq(guides.id, guideId)).limit(1))[0]
  if (!guide) return null
  const rows = await db
    .select()
    .from(guideVenues)
    .where(and(eq(guideVenues.guideId, guideId), eq(guideVenues.status, 'live')))
    .orderBy(asc(guideVenues.orderKey))
  const venueIds = rows.map((r) => r.venueId)
  const venueRows = venueIds.length
    ? await db.select().from(venues).where(inArray(venues.id, venueIds))
    : []
  const venueById = new Map(venueRows.map((v) => [v.id, v]))
  const venueRowsOut = rows.map((r) => {
    const venue = venueById.get(r.venueId)!
    return {
      id: r.id,
      venueId: r.venueId,
      orderKey: r.orderKey,
      overrideText: r.overrideText,
      pinned: r.pinned,
      venue: toVenuePublic(venue),
    }
  })
  return { guide: toGuide(guide), venueRows: venueRowsOut }
}

const guideView = server.implement(guideViewContract).handler(async ({ input, errors, context }) => {
  const view = await loadGuideView(context.db, input.id)
  if (!view) return err(errors.notFound({ guideId: input.id }))
  return ok(view)
})

const guideViewBySlug = server
  .implement(guideViewBySlugContract)
  .handler(async ({ input, errors, context }) => {
    const guide = (
      await context.db.select().from(guides).where(eq(guides.slug, input.slug)).limit(1)
    )[0]
    if (!guide) return err(errors.notFound({ guideId: input.slug }))
    const view = await loadGuideView(context.db, guide.id)
    return ok(view!)
  })

const guideBuilder = server
  .implement(guideBuilderContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const guide = (
      await context.db.select().from(guides).where(eq(guides.id, input.guideId)).limit(1)
    )[0]
    if (!guide) return err(errors.notFound({ guideId: input.guideId }))
    const rows = await context.db
      .select()
      .from(guideVenues)
      .where(and(eq(guideVenues.guideId, input.guideId), ne(guideVenues.status, 'removed')))
      .orderBy(asc(guideVenues.orderKey))
    const venueIds = rows.map((r) => r.venueId)
    const venueRows = venueIds.length
      ? await context.db.select().from(venues).where(inArray(venues.id, venueIds))
      : []
    const venueById = new Map(venueRows.map((v) => [v.id, v]))
    const excludes = await context.db
      .select({ venueId: guideExcludes.venueId, name: venues.name })
      .from(guideExcludes)
      .leftJoin(venues, eq(venues.id, guideExcludes.venueId))
      .where(eq(guideExcludes.guideId, input.guideId))
    return ok({
      guide: toGuide(guide),
      rows: rows
        .map((r) => {
          const venue = venueById.get(r.venueId)
          if (!venue) return null
          return {
            id: r.id,
            venueId: r.venueId,
            status: r.status,
            orderKey: r.orderKey,
            overrideText: r.overrideText,
            pinned: r.pinned,
            // Exactly the picked fields — pick() rejects unknown properties.
            venue: {
              id: venue.id,
              name: venue.name,
              category: venue.category,
              address: venue.address,
              confidence: venue.confidence,
              photos: venue.photos,
            },
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
      excludes: excludes.map((e) => ({ venueId: e.venueId, name: e.name ?? '' })),
    })
  })

const updateGuideVenue = server
  .implement(updateGuideVenueContract).use(requireStaff)
  .handler(async ({ input, errors, context }) => {
    const row = (
      await context.db.select().from(guideVenues).where(eq(guideVenues.id, input.id)).limit(1)
    )[0]
    if (!row) return err(errors.notFound({ id: input.id }))
    const updated = (
      await context.db
        .update(guideVenues)
        .set({
          ...(input.orderKey !== undefined ? { orderKey: input.orderKey } : {}),
          ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
          ...(input.overrideText !== undefined ? { overrideText: input.overrideText } : {}),
          updatedAt: new Date(),
        })
        .where(eq(guideVenues.id, input.id))
        .returning()
    )[0]
    await audit(context.db, {
      actor: 'staff',
      action: 'guide-venue.update',
      entityType: 'guide',
      entityId: row.guideId,
      after: {
        ...(input.orderKey !== undefined ? { orderKey: input.orderKey } : {}),
        ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
        ...(input.overrideText !== undefined ? { overrideText: input.overrideText } : {}),
      },
    })
    return ok(toGuideVenue(updated!))
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
