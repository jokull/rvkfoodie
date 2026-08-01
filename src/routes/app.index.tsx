/**
 * Operator dashboard — the aggregate numbers, nothing more until the CRM
 * and guide-builder screens land (ticket 11).
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { ResultRpcHydrationBoundary, useResultQuery } from 'result-rpc/react'
import { client } from '../rpc-client.js'
import { prefetchAppDashboard } from '../ssr.js'

export const Route = createFileRoute('/app/')({
  loader: () => prefetchAppDashboard(),
  component: Dashboard,
})

function Stats() {
  const stats = useResultQuery(client.stats.overview, {}, { staleTime: 60_000 })
  if (stats.state === 'pending') return <p className="muted">…</p>
  if (stats.state === 'failure') return null
  return (
    <div className="stats">
      <div className="stat">
        <strong>{stats.value.venueCount}</strong>
        <span>venues</span>
      </div>
      <div className="stat">
        <strong>{stats.value.liveVenueCount}</strong>
        <span>live</span>
      </div>
      <div className="stat">
        <strong>{stats.value.hotelCount}</strong>
        <span>hotels</span>
      </div>
    </div>
  )
}

function Dashboard() {
  return (
    <ResultRpcHydrationBoundary state={Route.useLoaderData()}>
      <h1 className="page-title">Dashboard</h1>
      <Stats />
      <p className="muted">
        Next screens: <Link to="/app/venues">venues</Link> (live), then CRM,
        guide builder and the monthly pass queue.
      </p>
    </ResultRpcHydrationBoundary>
  )
}
