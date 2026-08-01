/**
 * Venue detail — the full CRUD surface: summary, edit form, status toggle,
 * lifecycle, awards, audit trail. Mutations return Venue entities, so the
 * cache patches in place; the audit list is invalidated explicitly after
 * each write.
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { ResultRpcHydrationBoundary, useResultMutation, useResultQuery, useResultRuntime } from 'result-rpc/react'
import { client } from '../rpc-client.js'
import { VenueAwards } from '../components/venue-awards.js'
import { VenueEditForm } from '../components/venue-edit-form.js'
import { VenueLifecycle } from '../components/venue-lifecycle.js'
import { VenuePhotos } from '../components/venue-photos.js'
import { prefetchVenueDetail } from '../ssr.js'

export const Route = createFileRoute('/app/venues_/$venueId')({
  loader: ({ params }) => prefetchVenueDetail({ data: { id: params.venueId } }),
  component: VenueDetail,
})

const photoUrl = (photos: readonly string[]): string | null => {
  const p = photos[0]
  if (!p) return null
  return p.replace(/^(https?:\/\/media\.rvkfoodie\.is)\/?(.*)$/, '$1/cdn-cgi/image/width=640,fit=scale-down,format=webp/$2')
}

function AuditTrail({ venueId }: { venueId: string }) {
  const audit = useResultQuery(client.audit.list, { entityType: 'venue', entityId: venueId }, { staleTime: 30_000 })
  if (audit.state === 'failure') return <p className="error">Audit failed: {audit.error._tag}</p>
  if (audit.state === 'pending') return <p className="muted small">…</p>
  if (audit.value.length === 0) return <p className="muted small">No audit entries.</p>
  return (
    <ul className="audit-list">
      {audit.value.map((entry) => (
        <li key={entry.id}>
          <span className="muted small">{new Date(entry.at).toISOString().slice(0, 16).replace('T', ' ')}</span>
          <code>{entry.actor}</code>
          <span>{entry.action}</span>
          {entry.after && <span className="muted small">{entry.after.slice(0, 140)}</span>}
        </li>
      ))}
    </ul>
  )
}

function VenueDetail() {
  return (
    <ResultRpcHydrationBoundary state={Route.useLoaderData()}>
      <VenueDetailInner />
    </ResultRpcHydrationBoundary>
  )
}

function VenueDetailInner() {
  const { venueId } = Route.useParams()
  const venue = useResultQuery(client.venues.byId, { id: venueId }, { staleTime: 60_000 })
  const runtime = useResultRuntime()
  const setStatus = useResultMutation(client.venues.setStatus, {
    onSuccess: () =>
      void runtime.cache.invalidate(client.audit.list, { entityType: 'venue', entityId: venueId }),
  })

  if (venue.state === 'pending') return <p className="muted">Loading venue…</p>
  if (venue.state === 'failure')
    return (
      <p className="error">
        {venue.error._tag === 'venue/not-found' ? 'Venue not found.' : `Failed: ${venue.error._tag}`}
      </p>
    )

  const v = venue.value
  const img = photoUrl(v.photos)
  const next = v.status === 'live' ? 'closed' : 'live'
  return (
    <div>
      <p className="muted small">
        <Link to="/app/venues">← all venues</Link>
      </p>
      <div className="venue-hero">
        {img && <img className="venue-hero-photo" src={img} alt={v.name} />}
        <div>
          <h1 className="page-title">{v.name}</h1>
          <div className="venue-badges">
            <span className={`badge status-${v.status}`}>{v.status}</span>
            <span className="badge">{v.category}</span>
            {v.categorySecondary && <span className="badge">{v.categorySecondary}</span>}
            {v.cuisine && <span className="badge">{v.cuisine}</span>}
            <span className="venue-confidence" title="Editorial confidence">
              {Math.round(v.confidence * 100)}%
            </span>
          </div>
          <p className="muted small">
            {v.address}
            {v.openingHours ? ` · ${v.openingHours}` : ''}
            {v.website ? ` · ${v.website}` : ''}
            {v.phone ? ` · ${v.phone}` : ''}
          </p>
          <button
            className="toggle"
            disabled={setStatus.state === 'pending'}
            onClick={() => setStatus.mutate({ id: v.id, status: next })}
          >
            {setStatus.state === 'pending' ? '…' : next === 'live' ? 'Mark live' : 'Mark closed'}
          </button>
        </div>
      </div>
      <VenueEditForm venue={v} />
      <VenuePhotos venueId={v.id} photos={v.photos} />
      <VenueLifecycle venueId={v.id} />
      <VenueAwards venueId={v.id} />
      <section className="panel">
        <h2 className="panel-title">Audit trail</h2>
        <AuditTrail venueId={v.id} />
      </section>
    </div>
  )
}
