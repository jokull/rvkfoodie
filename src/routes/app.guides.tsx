/**
 * Guide builder — the list of guides with their hotel + status, and a
 * create-a-guide picker for hotels without one.
 */
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { ResultRpcHydrationBoundary, useResultMutation, useResultQuery } from 'result-rpc/react'
import { client } from '../rpc-client.js'
import { prefetchGuides } from '../ssr.js'

export const Route = createFileRoute('/app/guides')({
  loader: () => prefetchGuides(),
  component: Guides,
})

function Guides() {
  return (
    <ResultRpcHydrationBoundary state={Route.useLoaderData()}>
      <GuidesInner />
    </ResultRpcHydrationBoundary>
  )
}

function GuidesInner() {
  const router = useRouter()
  const guides = useResultQuery(client.guides.list, {}, { staleTime: 60_000 })
  const hotels = useResultQuery(client.hotels.list, {}, { staleTime: 60_000 })
  const create = useResultMutation(client.guides.create, {
    onSuccess: (guide) =>
      void router.navigate({ to: '/app/guides/$guideId', params: { guideId: guide.id } }),
  })

  if (guides.state === 'pending' || hotels.state === 'pending') return <p className="muted">Loading…</p>
  if (guides.state === 'failure' || hotels.state === 'failure') return <p className="error">Failed to load guides.</p>

  const byHotel = new Map(guides.value.map((g) => [g.hotelId, g]))
  const hotelName = new Map(hotels.value.map((h) => [h.id, h.name]))
  const without = hotels.value.filter((h) => !byHotel.has(h.id))

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Guide builder</h1>
      </div>
      <ul className="venue-list">
        {guides.value.map((g) => (
          <li key={g.id}>
            <Link to="/app/guides/$guideId" params={{ guideId: g.id }} className="venue-row">
              <span className="venue-row-body">
                <strong>{hotelName.get(g.hotelId) ?? g.slug}</strong>
                <span className="muted small">/{g.slug}</span>
              </span>
              <span className={`badge status-${g.status}`}>{g.status}</span>
            </Link>
          </li>
        ))}
      </ul>
      {without.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">Hotels without a guide</h2>
          <div className="lifecycle-form">
            <select
              aria-label="Hotel"
              value=""
              onChange={(e) => {
                const id = e.target.value
                if (id) void create.mutate({ hotelId: id })
                e.target.value = ''
              }}
            >
              <option value="">Choose a hotel…</option>
              {without.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            {create.state === 'failure' && <span className="error">Failed: {create.error._tag}</span>}
          </div>
        </section>
      )}
    </>
  )
}
