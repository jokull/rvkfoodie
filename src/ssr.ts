/**
 * The SSR prefetch layer.
 *
 * Route loaders are isomorphic — they run on the server during the document
 * request and in the browser on client-side navigation — so a loader may not
 * import the database. `createServerFn` is the server boundary: Start
 * compiles the handler out of the client bundle and leaves a fetch stub.
 *
 * Each server function builds a per-request query runtime over an in-process
 * PARITY server client (same middleware, codecs, envelope as the wire),
 * prefetches, and returns `runtime.dehydrate()` — a plain
 * `{ v, serializer, payload }` value that rides the loader's SSR payload.
 * The route component hands it to `<ResultRpcHydrationBoundary>`.
 */
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { createQueryRuntime } from 'result-rpc/query'
import { createServerClient } from 'result-rpc/server'
import { auth } from './auth.js'
import { createContext, router } from './rpc-server.js'

const buildRuntime = async () => {
  // The request headers ride into the context so session-gated queries
  // (guide builder) prefetch with the caller's auth.
  const serverClient = createServerClient(router, {
    context: await createContext({ request: { headers: getRequestHeaders() } as Request }),
  })
  return { runtime: createQueryRuntime({ client: serverClient }), serverClient }
}

/** Home route loader: feed + aggregate + hotels, in one payload. */
export const prefetchHome = createServerFn({ method: 'GET' }).handler(async () => {
  const { runtime, serverClient } = await buildRuntime()
  await Promise.all([
    runtime.prefetchPaginated(serverClient.venues.feed, {}),
    runtime.prefetch(serverClient.stats.overview, {}),
    runtime.prefetch(serverClient.hotels.list, {}),
  ])
  return runtime.dehydrate()
})

/** Guide page loader, keyed by the public slug. */
export const prefetchGuide = createServerFn({ method: 'GET' })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { runtime, serverClient } = await buildRuntime()
    await runtime.prefetch(serverClient.guides.viewBySlug, { slug: data.slug })
    return runtime.dehydrate()
  })

/** The current session, for loaders. Null when signed out. */
export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  return auth.api.getSession({ headers: getRequestHeaders() })
})

/** /app dashboard: aggregates + hotels, one payload. */
export const prefetchAppDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const { runtime, serverClient } = await buildRuntime()
  await Promise.all([
    runtime.prefetch(serverClient.stats.overview, {}),
    runtime.prefetch(serverClient.hotels.list, {}),
  ])
  return runtime.dehydrate()
})

/** /app/venues: the full venue inventory + overview, one payload. */
export const prefetchVenues = createServerFn({ method: 'GET' }).handler(async () => {
  const { runtime, serverClient } = await buildRuntime()
  await Promise.all([
    runtime.prefetchPaginated(serverClient.venues.feed, {}),
    runtime.prefetch(serverClient.stats.overview, {}),
  ])
  return runtime.dehydrate()
})

/** /app/venues/$venueId: detail + lifecycle + awards + audit, one payload. */
export const prefetchVenueDetail = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { runtime, serverClient } = await buildRuntime()
    await Promise.all([
      runtime.prefetch(serverClient.venues.byId, { id: data.id }),
      runtime.prefetch(serverClient.venues.listLifecycle, { venueId: data.id }),
      runtime.prefetch(serverClient.venueAwards.list, { venueId: data.id }),
      runtime.prefetch(serverClient.audit.list, { entityType: 'venue', entityId: data.id }),
    ])
    return runtime.dehydrate()
  })

/** /app/crm: the business list, one payload. */
export const prefetchCrm = createServerFn({ method: 'GET' }).handler(async () => {
  const { runtime, serverClient } = await buildRuntime()
  await runtime.prefetch(serverClient.businesses.list, {})
  return runtime.dehydrate()
})

/** /app/crm/$businessId: business + hotels + contacts + deals, one payload. */
export const prefetchBusinessDetail = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { runtime, serverClient } = await buildRuntime()
    await Promise.all([
      runtime.prefetch(serverClient.businesses.byId, { id: data.id }),
      runtime.prefetch(serverClient.hotels.listByBusiness, { businessId: data.id }),
      runtime.prefetch(serverClient.contacts.listByBusiness, { businessId: data.id }),
      runtime.prefetch(serverClient.deals.listByBusiness, { businessId: data.id }),
    ])
    return runtime.dehydrate()
  })

/** /app/guides: all guides + hotels (for the create picker), one payload. */
export const prefetchGuides = createServerFn({ method: 'GET' }).handler(async () => {
  const { runtime, serverClient } = await buildRuntime()
  await Promise.all([
    runtime.prefetch(serverClient.guides.list, {}),
    runtime.prefetch(serverClient.hotels.list, {}),
  ])
  return runtime.dehydrate()
})

/** /app/guides/$guideId: the builder snapshot (rows + excludes), one payload. */
export const prefetchGuideBuilder = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { runtime, serverClient } = await buildRuntime()
    await runtime.prefetch(serverClient.guides.builder, { guideId: data.id })
    return runtime.dehydrate()
  })
