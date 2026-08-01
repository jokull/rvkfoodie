/**
 * The shared contract — the ONLY result-rpc surface client components may
 * import. It carries codecs, error definitions, and invalidation maps; no
 * handlers, no Drizzle driver, no secrets. `AppContext` is imported type-only
 * from the server half (erased at build).
 */
import { pickErrors, rpc, wire } from 'result-rpc'
import { venueErrors } from './errors.js'
import { AuditEntry, Hotel, LifecycleEvent, OverviewCodec, Venue } from './models.js'
import { LIFECYCLE_TYPES, VENUE_CATEGORIES } from './schema.js'
import type { AppContext } from './rpc-server.js'

export const app = rpc.context<AppContext>()

/** Non-empty string-literal union — the wire.enum spelling available in
 * result-rpc 0.2.0 (union of wire.literal, identical contract digest). */
const enumOf = <const TValues extends readonly [string, ...string[]]>(values: TValues) =>
  wire.union(values.map((v) => wire.literal(v)))

/**
 * Cursor-paginated feed over the Venue ENTITY in curated order. One cache
 * entry per list identity; the cursor is the last item's orderKey.
 */
export const venueFeedContract = app
  .procedure()
  .input(wire.object({}))
  .output(Venue.all('every venue field is public'))
  .paginate({ cursor: wire.string })

export const venueByIdContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(Venue.all('every venue field is public'))
  .errors({ ...pickErrors(venueErrors, 'notFound') })
  .query()

/** One-off aggregate over the tables — kept fresh via `.affects()`. */
export const overviewContract = app
  .procedure()
  .input(wire.object({}))
  .output(OverviewCodec)
  .query()

/** The SPA's venue create form surface. */
export const addVenueContract = app
  .procedure()
  .input(
    wire.object({
      name: wire.string,
      category: enumOf(VENUE_CATEGORIES),
      address: wire.string,
      categorySecondary: wire.optional(wire.string),
      cuisine: wire.optional(wire.string),
      priceLevel: wire.optional(wire.integer({ min: 1, max: 4 })),
      note: wire.optional(wire.string),
      openingHours: wire.optional(wire.string),
      dineoutId: wire.optional(wire.string),
      googlePlacesId: wire.optional(wire.string),
      lat: wire.optional(wire.number),
      lon: wire.optional(wire.number),
    }),
  )
  .output(Venue.all('every venue field is public'))
  .errors({ ...pickErrors(venueErrors, 'nameTaken') })
  .affects(venueFeedContract)
  .affects(overviewContract)
  .mutation()

/** Partial edit — absent fields are left untouched. */
export const updateVenueContract = app
  .procedure()
  .input(
    wire.object({
      id: wire.string,
      name: wire.optional(wire.string),
      category: wire.optional(enumOf(VENUE_CATEGORIES)),
      address: wire.optional(wire.string),
      categorySecondary: wire.optional(wire.string),
      cuisine: wire.optional(wire.string),
      priceLevel: wire.optional(wire.integer({ min: 1, max: 4 })),
      note: wire.optional(wire.string),
      openingHours: wire.optional(wire.string),
      dineoutId: wire.optional(wire.string),
      googlePlacesId: wire.optional(wire.string),
      lat: wire.optional(wire.number),
      lon: wire.optional(wire.number),
      tags: wire.optional(wire.array(wire.string)),
      recommendedDishes: wire.optional(wire.array(wire.string)),
      photos: wire.optional(wire.array(wire.string)),
    }),
  )
  .output(Venue.all('every venue field is public'))
  .errors({ ...pickErrors(venueErrors, 'notFound', 'nameTaken') })
  .affects(venueFeedContract)
  .affects(overviewContract)
  .mutation()

/** Editorial status toggle (mark closed / mark live). */
export const setVenueStatusContract = app
  .procedure()
  .input(wire.object({ id: wire.string, status: wire.string }))
  .output(Venue.all('every venue field is public'))
  .errors({ ...pickErrors(venueErrors, 'notFound') })
  .affects(overviewContract)
  .mutation()

/**
 * A lifecycle event (closed / temporarily-closed / reopened) mechanically
 * drives venue status + confidence (closure → status closed, confidence 0;
 * reopened → status live). Returns the event; invalidates venue surfaces.
 */
export const addLifecycleEventContract = app
  .procedure()
  .input(
    wire.object({
      venueId: wire.string,
      type: enumOf(LIFECYCLE_TYPES),
      startedAt: wire.date,
      note: wire.optional(wire.string),
    }),
  )
  .output(LifecycleEvent.all('lifecycle events are public'))
  .errors({ ...pickErrors(venueErrors, 'notFound') })
  .affects(venueFeedContract)
  .affects(venueByIdContract)
  .affects(overviewContract)
  .mutation()

export const listLifecycleContract = app
  .procedure()
  .input(wire.object({ venueId: wire.string }))
  .output(wire.array(LifecycleEvent.all('lifecycle events are public')))
  .query()

export const auditListContract = app
  .procedure()
  .input(wire.object({ entityType: wire.string, entityId: wire.string }))
  .output(wire.array(AuditEntry.all('audit entries are public to staff')))
  .query()

export const hotelsListContract = app
  .procedure()
  .input(wire.object({}))
  .output(wire.array(Hotel.all('every hotel field is public')))
  .query()

export const appContract = app.contract({
  venues: {
    feed: venueFeedContract,
    byId: venueByIdContract,
    add: addVenueContract,
    update: updateVenueContract,
    setStatus: setVenueStatusContract,
    addLifecycleEvent: addLifecycleEventContract,
    listLifecycle: listLifecycleContract,
  },
  audit: {
    list: auditListContract,
  },
  hotels: {
    list: hotelsListContract,
  },
  stats: {
    overview: overviewContract,
  },
})
