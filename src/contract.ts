/**
 * The shared contract — the ONLY result-rpc surface client components may
 * import. It carries codecs, error definitions, and invalidation maps; no
 * handlers, no Drizzle driver, no secrets. `AppContext` is imported type-only
 * from the server half (erased at build).
 */
import { pickErrors, rpc, wire } from 'result-rpc'
import {
  businessErrors,
  contactErrors,
  dealErrors,
  hotelErrors,
  venueErrors,
} from './errors.js'
import {
  AuditEntry,
  Business,
  Contact,
  Deal,
  Hotel,
  LifecycleEvent,
  OverviewCodec,
  Venue,
} from './models.js'
import { LIFECYCLE_TYPES, PIPELINE_STAGES, VENUE_CATEGORIES } from './schema.js'
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

// --- CRM: businesses -----------------------------------------------------

export const businessListContract = app
  .procedure()
  .input(wire.object({}))
  .output(wire.array(Business.all('every business field is staff-visible')))
  .query()

export const businessByIdContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(Business.all('every business field is staff-visible'))
  .errors({ ...pickErrors(businessErrors, 'notFound') })
  .query()

export const addBusinessContract = app
  .procedure()
  .input(
    wire.object({
      name: wire.string,
      website: wire.optional(wire.string),
      industry: wire.optional(wire.string),
      notes: wire.optional(wire.string),
    }),
  )
  .output(Business.all('every business field is staff-visible'))
  .errors({ ...pickErrors(businessErrors, 'nameTaken') })
  .affects(businessListContract)
  .mutation()

export const updateBusinessContract = app
  .procedure()
  .input(
    wire.object({
      id: wire.string,
      name: wire.optional(wire.string),
      website: wire.optional(wire.string),
      industry: wire.optional(wire.string),
      notes: wire.optional(wire.string),
    }),
  )
  .output(Business.all('every business field is staff-visible'))
  .errors({ ...pickErrors(businessErrors, 'notFound', 'nameTaken') })
  .affects(businessListContract)
  .mutation()

// --- CRM: hotels (properties) -------------------------------------------

export const hotelsByBusinessContract = app
  .procedure()
  .input(wire.object({ businessId: wire.string }))
  .output(wire.array(Hotel.all('every hotel field is public')))
  .query()

export const addHotelContract = app
  .procedure()
  .input(
    wire.object({
      businessId: wire.optional(wire.string),
      name: wire.string,
      address: wire.optional(wire.string),
      lat: wire.optional(wire.number),
      lon: wire.optional(wire.number),
      roomCount: wire.optional(wire.integer({ min: 0 })),
      website: wire.optional(wire.string),
      notes: wire.optional(wire.string),
    }),
  )
  .output(Hotel.all('every hotel field is public'))
  .errors({ ...pickErrors(hotelErrors, 'notFound') })
  .affects(hotelsListContract)
  .affects(hotelsByBusinessContract)
  .mutation()

export const updateHotelContract = app
  .procedure()
  .input(
    wire.object({
      id: wire.string,
      businessId: wire.optional(wire.string),
      name: wire.optional(wire.string),
      address: wire.optional(wire.string),
      lat: wire.optional(wire.number),
      lon: wire.optional(wire.number),
      roomCount: wire.optional(wire.integer({ min: 0 })),
      website: wire.optional(wire.string),
      notes: wire.optional(wire.string),
    }),
  )
  .output(Hotel.all('every hotel field is public'))
  .errors({ ...pickErrors(hotelErrors, 'notFound') })
  .affects(hotelsListContract)
  .affects(hotelsByBusinessContract)
  .mutation()

// --- CRM: contacts -------------------------------------------------------

export const contactsByBusinessContract = app
  .procedure()
  .input(wire.object({ businessId: wire.string }))
  .output(wire.array(Contact.all('every contact field is staff-visible')))
  .query()

export const addContactContract = app
  .procedure()
  .input(
    wire.object({
      businessId: wire.string,
      hotelId: wire.optional(wire.string),
      firstName: wire.optional(wire.string),
      lastName: wire.optional(wire.string),
      email: wire.optional(wire.string),
      phone: wire.optional(wire.string),
      title: wire.optional(wire.string),
      isDecisionMaker: wire.optional(wire.boolean),
      notes: wire.optional(wire.string),
    }),
  )
  .output(Contact.all('every contact field is staff-visible'))
  .affects(contactsByBusinessContract)
  .mutation()

export const updateContactContract = app
  .procedure()
  .input(
    wire.object({
      id: wire.string,
      hotelId: wire.optional(wire.string),
      firstName: wire.optional(wire.string),
      lastName: wire.optional(wire.string),
      email: wire.optional(wire.string),
      phone: wire.optional(wire.string),
      title: wire.optional(wire.string),
      isDecisionMaker: wire.optional(wire.boolean),
      notes: wire.optional(wire.string),
    }),
  )
  .output(Contact.all('every contact field is staff-visible'))
  .errors({ ...pickErrors(contactErrors, 'notFound') })
  .affects(contactsByBusinessContract)
  .mutation()

// --- CRM: deals ----------------------------------------------------------

export const dealsByBusinessContract = app
  .procedure()
  .input(wire.object({ businessId: wire.string }))
  .output(wire.array(Deal.all('every deal field is staff-visible')))
  .query()

export const addDealContract = app
  .procedure()
  .input(
    wire.object({
      businessId: wire.string,
      name: wire.string,
      stage: wire.optional(enumOf(PIPELINE_STAGES)),
      pricePerRoom: wire.optional(wire.integer({ min: 0 })),
      annualValue: wire.optional(wire.integer({ min: 0 })),
      startDate: wire.optional(wire.date),
      renewalDate: wire.optional(wire.date),
      notes: wire.optional(wire.string),
    }),
  )
  .output(Deal.all('every deal field is staff-visible'))
  .affects(dealsByBusinessContract)
  .mutation()

export const updateDealContract = app
  .procedure()
  .input(
    wire.object({
      id: wire.string,
      name: wire.optional(wire.string),
      stage: wire.optional(enumOf(PIPELINE_STAGES)),
      pricePerRoom: wire.optional(wire.integer({ min: 0 })),
      annualValue: wire.optional(wire.integer({ min: 0 })),
      startDate: wire.optional(wire.date),
      renewalDate: wire.optional(wire.date),
      notes: wire.optional(wire.string),
    }),
  )
  .output(Deal.all('every deal field is staff-visible'))
  .errors({ ...pickErrors(dealErrors, 'notFound') })
  .affects(dealsByBusinessContract)
  .mutation()

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
    listByBusiness: hotelsByBusinessContract,
    add: addHotelContract,
    update: updateHotelContract,
  },
  businesses: {
    list: businessListContract,
    byId: businessByIdContract,
    add: addBusinessContract,
    update: updateBusinessContract,
  },
  contacts: {
    listByBusiness: contactsByBusinessContract,
    add: addContactContract,
    update: updateContactContract,
  },
  deals: {
    listByBusiness: dealsByBusinessContract,
    add: addDealContract,
    update: updateDealContract,
  },
  stats: {
    overview: overviewContract,
  },
})
