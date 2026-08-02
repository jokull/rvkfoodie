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

// ============ Public consumer site (agent-cms read path) ============
// These server fns return plain data (not result-rpc payloads) — the CMS
// layer has its own cache story (in-process agent-cms GraphQL).

import { getCookie } from '@tanstack/react-start/server'

/** / — home: homePage singleton + guides + editorials. */
export const prefetchPublicHome = createServerFn({ method: 'GET' }).handler(async () => {
  const { getHomePageData } = await import('./cms.js')
  return getHomePageData()
})

/** /guides/$slug — guide + all guides + editorials + this browser's unlocks. */
export const prefetchPublicGuide = createServerFn({ method: 'GET' })
  .validator(
    (data: { slug: string; error?: string; pending?: string; key?: string }) => data,
  )
  .handler(async ({ data }) => {
    const [{ getGuidePageData }, { getSessionData, SESSION_COOKIE }] = await Promise.all([
      import('./cms.js'),
      import('./session.js'),
    ])
    const sessionId = getCookie(SESSION_COOKIE)
    const [page, unlocked] = await Promise.all([
      getGuidePageData(data.slug),
      sessionId ? getSessionData<string[]>(sessionId, 'unlockedProducts').catch(() => null) : Promise.resolve(null),
    ])
    return { ...page, unlockedProducts: unlocked ?? [], error: data.error, pending: data.pending, key: data.key }
  })

/** /blog — the editorial index. */
export const prefetchPublicBlogList = createServerFn({ method: 'GET' }).handler(async () => {
  const cms = await import('./cms.js')
  return cms.getAllEditorials()
})

/** /blog/$slug — post + guides + editorials. */
export const prefetchPublicBlogPost = createServerFn({ method: 'GET' })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { getBlogPageData } = await import('./cms.js')
    return getBlogPageData(data.slug)
  })

/** /changelog — entries + subtitle. */
export const prefetchPublicChangelog = createServerFn({ method: 'GET' }).handler(async () => {
  const { getChangelogPageData } = await import('./cms.js')
  return getChangelogPageData()
})

/** /about — the about singleton + guides. */
export const prefetchPublicAbout = createServerFn({ method: 'GET' }).handler(async () => {
  const { getAboutPageData } = await import('./cms.js')
  return getAboutPageData()
})

/** /sitemap — guide + editorial URLs. */
export const prefetchPublicSitemap = createServerFn({ method: 'GET' }).handler(async () => {
  const { getChangelogPageData, getHomePageData } = await import('./cms.js')
  const [home, changelog] = await Promise.all([getHomePageData(), getChangelogPageData()])
  return {
    guides: home.guides.map((g) => g.slug),
    editorials: home.editorials.map((e) => e.slug),
    changelog: changelog.entries.map((e) => e.id),
  }
})
