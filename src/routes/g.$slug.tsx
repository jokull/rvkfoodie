/**
 * The public guide page — /g/<slug>.
 *
 * Server-rendered, noindex, public (security by obscurity, per the map).
 * The loader prefetches guides.viewBySlug and hydrates, so first paint has
 * the venue rows with no client round-trip. The map is client-only (Leaflet
 * needs the DOM) — mounted in useEffect.
 *
 * The guide is a SHORTLIST: venue cards grouped by standard category, the
 * first venue of each section carrying the "editor's pick" marker
 * (highest-confidence in that section).
 */
import { createFileRoute, Link } from '@tanstack/react-router'
import { ResultRpcHydrationBoundary } from 'result-rpc/react'
import { GuidePage } from '../components/guide-page.js'
import { prefetchGuide } from '../ssr.js'

export const Route = createFileRoute('/g/$slug')({
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex' }],
  }),
  loader: ({ params }) => prefetchGuide({ data: { slug: params.slug } }),
  component: GuideRoute,
  errorComponent: ({ error }) => (
    <div className="guide-shell">
      <p className="muted">
        <Link to="/">← rvkfoodie.is</Link>
      </p>
      <p className="error">This guide is not available.</p>
    </div>
  ),
})

function GuideRoute() {
  const { slug } = Route.useParams()
  const { state, turnstileSiteKey } = Route.useLoaderData()
  return (
    <ResultRpcHydrationBoundary state={state}>
      <GuidePage slug={slug} turnstileSiteKey={turnstileSiteKey} />
    </ResultRpcHydrationBoundary>
  )
}
