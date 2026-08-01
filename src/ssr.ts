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

const buildRuntime = () => {
  const serverClient = createServerClient(router, {
    context: createContext(),
  })
  return { runtime: createQueryRuntime({ client: serverClient }), serverClient }
}

/** Home route loader: feed + aggregate + hotels, in one payload. */
export const prefetchHome = createServerFn({ method: 'GET' }).handler(async () => {
  const { runtime, serverClient } = buildRuntime()
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
    const { runtime, serverClient } = buildRuntime()
    await runtime.prefetch(serverClient.guides.viewBySlug, { slug: data.slug })
    return runtime.dehydrate()
  })

/** The current session, for loaders. Null when signed out. */
export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  return auth.api.getSession({ headers: getRequestHeaders() })
})
