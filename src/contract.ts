/**
 * The shared contract — the ONLY result-rpc surface client components may
 * import. It carries codecs, error definitions, and invalidation maps; no
 * handlers, no Drizzle driver, no secrets. `AppContext` is imported type-only
 * from the server half (erased at build).
 */
import { pickErrors, rpc, wire } from 'result-rpc'
import { venueErrors } from './errors.js'
import { Hotel, OverviewCodec, Venue } from './models.js'
import type { AppContext } from './rpc-server.js'

export const app = rpc.context<AppContext>()

/**
 * Cursor-paginated feed over the Venue ENTITY. One cache entry per list
 * identity; the cursor never keys anything.
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

/** One-off aggregate over both tables — kept fresh via `.affects()`. */
export const overviewContract = app
  .procedure()
  .input(wire.object({}))
  .output(OverviewCodec)
  .query()

/**
 * Insert path: the UNIQUE(name) constraint is the uniqueness check via
 * `tryDb` in the handler. Returns the Venue entity, so the new row lands in
 * the feed by identity; map-less `.affects()` also invalidates the list.
 */
export const addVenueContract = app
  .procedure()
  .input(
    wire.object({
      name: wire.string,
      category: wire.string,
      neighborhood: wire.string,
    }),
  )
  .output(Venue.all('every venue field is public'))
  .errors({ ...pickErrors(venueErrors, 'nameTaken') })
  .affects(venueFeedContract)
  .affects(overviewContract)
  .mutation()

/**
 * Status toggle (the editorial "mark closed / mark live" action). Returns
 * the Venue entity → the cache patches the row wherever it sits.
 */
export const setVenueStatusContract = app
  .procedure()
  .input(wire.object({ id: wire.string, status: wire.string }))
  .output(Venue.all('every venue field is public'))
  .errors({ ...pickErrors(venueErrors, 'notFound') })
  .affects(overviewContract)
  .mutation()

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
    setStatus: setVenueStatusContract,
  },
  hotels: {
    list: hotelsListContract,
  },
  stats: {
    overview: overviewContract,
  },
})
