/**
 * The shared contract — the ONLY result-rpc surface client components may
 * import. It carries codecs, error definitions, and invalidation maps; no
 * handlers, no Drizzle driver, no secrets. `AppContext` is imported type-only
 * from the server half (erased at build).
 */
import { pickErrors, rpc, wire } from 'result-rpc'
import {
  authErrors,
  businessErrors,
  contactErrors,
  dealErrors,
  guideErrors,
  guideVenueErrors,
  hotelErrors,
  venueAwardErrors,
  venueErrors,
} from './errors.js'
import {
  AuditEntry,
  Business,
  Contact,
  Deal,
  Guide,
  GuideVenue,
  GuideBuilderCodec,
  GuideViewCodec,
  Hotel,
  LifecycleEvent,
  OverviewCodec,
  Venue,
  VenueAward,
  DigestResult,
} from './models.js'
import { LIFECYCLE_TYPES, PIPELINE_STAGES, VENUE_AWARD_TYPES, VENUE_CATEGORIES } from './schema.js'
import type { AppContext } from './rpc-server.js'

export const app = rpc.context<AppContext>()

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
      category: wire.enum(VENUE_CATEGORIES),
      address: wire.string,
      categorySecondary: wire.optional(wire.string),
      cuisine: wire.optional(wire.string),
      priceLevel: wire.optional(wire.integer({ min: 1, max: 4 })),
      note: wire.optional(wire.string),
      openingHours: wire.optional(wire.string),
      dineoutId: wire.optional(wire.string),
      googlePlacesId: wire.optional(wire.string),
      website: wire.optional(wire.string),
      phone: wire.optional(wire.string),
      lat: wire.optional(wire.number),
      lon: wire.optional(wire.number),
    }),
  )
  .output(Venue.all('every venue field is public'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(venueErrors, 'nameTaken') })
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
      category: wire.optional(wire.enum(VENUE_CATEGORIES)),
      address: wire.optional(wire.string),
      categorySecondary: wire.optional(wire.string),
      cuisine: wire.optional(wire.string),
      priceLevel: wire.optional(wire.integer({ min: 1, max: 4 })),
      note: wire.optional(wire.string),
      openingHours: wire.optional(wire.string),
      dineoutId: wire.optional(wire.string),
      googlePlacesId: wire.optional(wire.string),
      website: wire.optional(wire.string),
      phone: wire.optional(wire.string),
      /** Staff-only fields: editorial confidence + last verification. */
      confidence: wire.optional(wire.number),
      lastVerifiedAt: wire.optional(wire.date),
      lat: wire.optional(wire.number),
      lon: wire.optional(wire.number),
      tags: wire.optional(wire.array(wire.string)),
      recommendedDishes: wire.optional(wire.array(wire.string)),
      photos: wire.optional(wire.array(wire.string)),
    }),
  )
  .output(Venue.all('every venue field is public'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(venueErrors, 'notFound', 'nameTaken') })
  .affects(venueFeedContract)
  .affects(overviewContract)
  .mutation()

/** Awards on a venue — the editor's-pick source for guide pages. */
export const venueAwardListContract = app
  .procedure()
  .input(wire.object({ venueId: wire.string }))
  .output(wire.array(VenueAward.all('awards are staff-visible')))
  .errors({ ...pickErrors(venueErrors, 'notFound') })
  .query()

export const venueAwardAddContract = app
  .procedure()
  .input(
    wire.object({
      venueId: wire.string,
      awardType: wire.enum(VENUE_AWARD_TYPES),
      title: wire.string,
      url: wire.optional(wire.string),
    }),
  )
  .output(VenueAward.all('awards are staff-visible'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(venueErrors, 'notFound'), ...pickErrors(venueAwardErrors, 'exists') })
  .affects(venueAwardListContract)
  .mutation()

export const venueAwardRemoveContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(wire.object({ removed: wire.boolean }))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(venueAwardErrors, 'notFound') })
  .affects(venueAwardListContract)
  .mutation()

/** Editorial status toggle (mark closed / mark live). */
export const setVenueStatusContract = app
  .procedure()
  .input(wire.object({ id: wire.string, status: wire.string }))
  .output(Venue.all('every venue field is public'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(venueErrors, 'notFound') })
  .affects(overviewContract)
  .mutation()

/**
 * A lifecycle event (closed / temporarily-closed / reopened) mechanically
 * drives venue status + confidence (closure → status closed, confidence 0;
 * reopened → status live). Returns the event; invalidates venue surfaces.
 */
export const listLifecycleContract = app
  .procedure()
  .input(wire.object({ venueId: wire.string }))
  .output(wire.array(LifecycleEvent.all('lifecycle events are public')))
  .query()

export const addLifecycleEventContract = app
  .procedure()
  .input(
    wire.object({
      venueId: wire.string,
      type: wire.enum(LIFECYCLE_TYPES),
      startedAt: wire.date,
      note: wire.optional(wire.string),
    }),
  )
  .output(LifecycleEvent.all('lifecycle events are public'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(venueErrors, 'notFound') })
  .affects(venueFeedContract)
  .affects(venueByIdContract)
  .affects(listLifecycleContract)
  .affects(overviewContract)
  .mutation()

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
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(businessErrors, 'nameTaken') })
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
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(businessErrors, 'notFound', 'nameTaken') })
  .affects(businessListContract)
  .mutation()

/** Per-business pipeline roll-up for the CRM list (latest stage, sum). */
export const businessDealSummariesContract = app
  .procedure()
  .input(wire.object({}))
  .output(
    wire.array(
      wire.object({
        businessId: wire.string,
        stage: wire.string,
        annualValue: wire.number,
        dealCount: wire.number,
      }),
    ),
  )
  .query()

export const removeBusinessContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(wire.object({ removed: wire.boolean }))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(businessErrors, 'notFound') })
  .affects(businessListContract)
  .affects(businessByIdContract)
  .affects(businessDealSummariesContract)
  .mutation()

/** Undo a soft delete — clears deletedAt (and, for businesses, its
 * soft-deleted children). Idempotent: restoring a live row returns it. */
export const restoreBusinessContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(Business.all('every business field is staff-visible'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(businessErrors, 'notFound') })
  .affects(businessListContract)
  .affects(businessByIdContract)
  .affects(businessDealSummariesContract)
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
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(hotelErrors, 'notFound') })
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
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(hotelErrors, 'notFound') })
  .affects(hotelsListContract)
  .affects(hotelsByBusinessContract)
  .mutation()

export const removeHotelContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(wire.object({ removed: wire.boolean }))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(hotelErrors, 'notFound') })
  .affects(hotelsListContract)
  .affects(hotelsByBusinessContract)
  .mutation()

/** Undo a soft delete — clears deletedAt. Idempotent. */
export const restoreHotelContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(Hotel.all('every hotel field is public'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(hotelErrors, 'notFound') })
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
  .errors({ ...pickErrors(authErrors, 'unauthorized') })
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
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(contactErrors, 'notFound') })
  .affects(contactsByBusinessContract)
  .mutation()

export const removeContactContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(wire.object({ removed: wire.boolean }))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(contactErrors, 'notFound') })
  .affects(contactsByBusinessContract)
  .mutation()

/** Undo a soft delete — clears deletedAt. Idempotent. */
export const restoreContactContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(Contact.all('every contact field is staff-visible'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(contactErrors, 'notFound') })
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
      stage: wire.optional(wire.enum(PIPELINE_STAGES)),
      pricePerRoom: wire.optional(wire.integer({ min: 0 })),
      annualValue: wire.optional(wire.integer({ min: 0 })),
      startDate: wire.optional(wire.date),
      renewalDate: wire.optional(wire.date),
      notes: wire.optional(wire.string),
    }),
  )
  .errors({ ...pickErrors(authErrors, 'unauthorized') })
  .output(Deal.all('every deal field is staff-visible'))
  .affects(dealsByBusinessContract)
  .affects(businessDealSummariesContract)
  .mutation()

export const updateDealContract = app
  .procedure()
  .input(
    wire.object({
      id: wire.string,
      name: wire.optional(wire.string),
      stage: wire.optional(wire.enum(PIPELINE_STAGES)),
      pricePerRoom: wire.optional(wire.integer({ min: 0 })),
      annualValue: wire.optional(wire.integer({ min: 0 })),
      startDate: wire.optional(wire.date),
      renewalDate: wire.optional(wire.date),
      notes: wire.optional(wire.string),
    }),
  )
  .output(Deal.all('every deal field is staff-visible'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(dealErrors, 'notFound') })
  .affects(dealsByBusinessContract)
  .affects(businessDealSummariesContract)
  .mutation()

export const removeDealContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(wire.object({ removed: wire.boolean }))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(dealErrors, 'notFound') })
  .affects(dealsByBusinessContract)
  .affects(businessDealSummariesContract)
  .mutation()

/** Undo a soft delete — clears deletedAt. Idempotent. */
export const restoreDealContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(Deal.all('every deal field is staff-visible'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(dealErrors, 'notFound') })
  .affects(dealsByBusinessContract)
  .affects(businessDealSummariesContract)
  .mutation()

// --- Guides ---------------------------------------------------------------

/** The public guide view — must be declared before draft/approve affects(). */
export const guideViewContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(GuideViewCodec)
  .errors({ ...pickErrors(guideErrors, 'notFound') })
  .query()

/** Public surface: the /g/<slug> page resolves by slug, never by id. */
export const guideViewBySlugContract = app
  .procedure()
  .input(wire.object({ slug: wire.string }))
  .output(GuideViewCodec)
  .errors({ ...pickErrors(guideErrors, 'notFound') })
  .query()

export const guideListContract = app
  .procedure()
  .input(wire.object({}))
  .output(wire.array(Guide.all('guide metadata is staff-visible')))
  .query()

export const guideByIdContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(Guide.all('guide metadata is staff-visible'))
  .errors({ ...pickErrors(guideErrors, 'notFound') })
  .query()

export const createGuideContract = app
  .procedure()
  .input(
    wire.object({
      hotelId: wire.string,
      radiusMin: wire.optional(wire.integer({ min: 1, max: 120 })),
      targetCount: wire.optional(wire.integer({ min: 1, max: 60 })),
    }),
  )
  .output(Guide.all('guide metadata is staff-visible'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(guideErrors, 'notFound') })
  .affects(guideListContract)
  .mutation()

export const guideBuilderContract = app
  .procedure()
  .input(wire.object({ guideId: wire.string }))
  .output(GuideBuilderCodec)
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(guideErrors, 'notFound') })
  .query()

/** Snapshot-row edits: reorder (fractional orderKey), pin, override text. */
export const updateGuideVenueContract = app
  .procedure()
  .input(
    wire.object({
      id: wire.string,
      orderKey: wire.optional(wire.string),
      pinned: wire.optional(wire.boolean),
      overrideText: wire.optional(wire.nullable(wire.string)),
    }),
  )
  .output(GuideVenue.all('guide venue rows are staff-visible'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(guideVenueErrors, 'notFound') })
  .affects(guideBuilderContract)
  .affects(guideViewContract)
  .mutation()

/** Merge re-draft: keep qualifying rows, drop closed, append pending picks. */
export const draftGuideContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(
    wire.object({
      kept: wire.number,
      dropped: wire.array(wire.string),
      added: wire.array(wire.string),
    }),
  )
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(guideErrors, 'notFound', 'noPool') })
  .affects(guideViewContract)
  .affects(guideByIdContract)
  .affects(guideBuilderContract)
  .mutation()

/** Promote generated pending rows to live — the maintenance-cycle approval. */
export const approveGuideCandidatesContract = app
  .procedure()
  .input(wire.object({ guideId: wire.string, venueIds: wire.array(wire.string) }))
  .output(wire.array(GuideVenue.all('guide venue rows are staff-visible')))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(guideErrors, 'notFound') })
  .affects(guideViewContract)
  .mutation()

/**
 * The monthly-pass finish: diff every live guide against the last digest
 * baseline and email affected hotels. First run snapshots the baseline
 * silently; afterwards only real changes produce mail.
 */
export const digestContract = app
  .procedure()
  .input(wire.object({ guideId: wire.optional(wire.string) }))
  .output(DigestResult)
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(guideErrors, 'notFound') })
  .mutation()

export const setGuideConfigContract = app
  .procedure()
  .input(
    wire.object({
      guideId: wire.string,
      radiusMin: wire.optional(wire.integer({ min: 1, max: 120 })),
      targetCount: wire.optional(wire.integer({ min: 1, max: 60 })),
    }),
  )
  .output(Guide.all('guide metadata is staff-visible'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(guideErrors, 'notFound') })
  .affects(guideByIdContract)
  .mutation()

export const publishGuideContract = app
  .procedure()
  .input(wire.object({ id: wire.string }))
  .output(Guide.all('guide metadata is staff-visible'))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(guideErrors, 'notFound') })
  .affects(guideListContract)
  .affects(guideByIdContract)
  .mutation()

export const addGuideExcludeContract = app
  .procedure()
  .input(wire.object({ guideId: wire.string, venueId: wire.string }))
  .output(wire.object({}))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(guideErrors, 'notFound') })
  .affects(guideViewContract)
  .mutation()

export const removeGuideExcludeContract = app
  .procedure()
  .input(wire.object({ guideId: wire.string, venueId: wire.string }))
  .output(wire.object({}))
  .errors({ ...pickErrors(authErrors, 'unauthorized'), ...pickErrors(guideErrors, 'notFound') })
  .affects(guideViewContract)
  .mutation()

/** Public: “email me this guide” — sends the guide as an HTML email. */
export const requestGuideCaptureContract = app
  .procedure()
  .input(wire.object({ slug: wire.string, email: wire.string }))
  .output(wire.object({}))
  .errors({ ...pickErrors(guideErrors, 'notFound') })
  .mutation()

/** Fire-and-forget analytics beacon — failures never surface. */
export const recordGuideEventContract = app
  .procedure()
  .input(
    wire.object({
      slug: wire.string,
      event: wire.enum(['view', 'qr-scan', 'venue-click', 'email-captured'] as const),
      venueId: wire.optional(wire.string),
    }),
  )
  .output(wire.object({}))
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
  venueAwards: {
    list: venueAwardListContract,
    add: venueAwardAddContract,
    remove: venueAwardRemoveContract,
  },
  audit: {
    list: auditListContract,
  },
  hotels: {
    list: hotelsListContract,
    listByBusiness: hotelsByBusinessContract,
    add: addHotelContract,
    update: updateHotelContract,
    remove: removeHotelContract,
    restore: restoreHotelContract,
  },
  businesses: {
    list: businessListContract,
    byId: businessByIdContract,
    add: addBusinessContract,
    update: updateBusinessContract,
    remove: removeBusinessContract,
    restore: restoreBusinessContract,
    summaries: businessDealSummariesContract,
  },
  contacts: {
    listByBusiness: contactsByBusinessContract,
    add: addContactContract,
    update: updateContactContract,
    remove: removeContactContract,
    restore: restoreContactContract,
  },
  deals: {
    listByBusiness: dealsByBusinessContract,
    add: addDealContract,
    update: updateDealContract,
    remove: removeDealContract,
    restore: restoreDealContract,
  },
  guides: {
    view: guideViewContract,
    viewBySlug: guideViewBySlugContract,
    list: guideListContract,
    byId: guideByIdContract,
    create: createGuideContract,
    draft: draftGuideContract,
    approveCandidates: approveGuideCandidatesContract,
    setConfig: setGuideConfigContract,
    publish: publishGuideContract,
    addExclude: addGuideExcludeContract,
    removeExclude: removeGuideExcludeContract,
    builder: guideBuilderContract,
    digest: digestContract,
  },
  guideVenues: {
    update: updateGuideVenueContract,
  },
  captures: {
    request: requestGuideCaptureContract,
  },
  events: {
    record: recordGuideEventContract,
  },
  stats: {
    overview: overviewContract,
  },
})
