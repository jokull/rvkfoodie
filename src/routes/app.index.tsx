/**
 * Operator dashboard — the aggregate numbers, nothing more until the CRM
 * and guide-builder screens land (ticket 11).
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { ResultRpcHydrationBoundary, useResultQuery } from 'result-rpc/react'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Surface } from '@cloudflare/kumo/components/surface'
import { Text } from '@cloudflare/kumo/components/text'
import { client } from '../rpc-client.js'
import { prefetchAppDashboard } from '../ssr.js'

export const Route = createFileRoute('/app/')({
  loader: () => prefetchAppDashboard(),
  component: Dashboard,
})

function Stats() {
  const stats = useResultQuery(client.stats.overview, {}, { staleTime: 60_000 })
  if (stats.state === 'pending') return <Loader size="sm" />
  if (stats.state === 'failure') return null
  return (
    <div className="mb-4 flex gap-4">
      <Surface className="flex flex-col rounded-lg bg-kumo-base px-4 py-2 ring-1 ring-kumo-line">
        <Text as="p" size="lg" bold>
          {stats.value.venueCount}
        </Text>
        <Text as="span" variant="secondary" size="xs">
          venues
        </Text>
      </Surface>
      <Surface className="flex flex-col rounded-lg bg-kumo-base px-4 py-2 ring-1 ring-kumo-line">
        <Text as="p" size="lg" bold>
          {stats.value.liveVenueCount}
        </Text>
        <Text as="span" variant="secondary" size="xs">
          live
        </Text>
      </Surface>
      <Surface className="flex flex-col rounded-lg bg-kumo-base px-4 py-2 ring-1 ring-kumo-line">
        <Text as="p" size="lg" bold>
          {stats.value.hotelCount}
        </Text>
        <Text as="span" variant="secondary" size="xs">
          hotels
        </Text>
      </Surface>
    </div>
  )
}

function Dashboard() {
  return (
    <ResultRpcHydrationBoundary state={Route.useLoaderData()}>
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <Stats />
      <p className="text-sm text-slate-500">
        Next screens: <Link to="/app/venues">venues</Link> (live), then CRM,
        guide builder and the monthly pass queue.
      </p>
    </ResultRpcHydrationBoundary>
  )
}
