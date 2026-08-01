/**
 * Monthly pass — the editorial review queue over the full inventory:
 * due-for-verification (stale lastVerifiedAt / low confidence), closure
 * candidates (closed or temporarily-closed via lifecycle), and recently
 * added venues. Actions re-verify, mark closed/live, and adjust
 * confidence — all existing venue mutations (entity patches keep rows in
 * sync). The hotel digest email is the remaining ticket-12 artifact.
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ResultRpcHydrationBoundary, useResultMutation, useResultPaginatedQuery } from 'result-rpc/react'
import type { VenueRow } from '../models.js'
import { client } from '../rpc-client.js'
import { prefetchVenues } from '../ssr.js'

export const Route = createFileRoute('/app/pass')({
  loader: () => prefetchVenues(),
  component: MonthlyPass,
})

const VERIFY_AFTER_DAYS = 120

const daysSince = (d: Date | null): number => (d ? (Date.now() - new Date(d).getTime()) / 86_400_000 : Infinity)

function QueueSection({ title, venues, count }: { title: string; venues: VenueRow[]; count?: number }) {
  if (venues.length === 0) return null
  return (
    <section className="panel">
      <h2 className="panel-title">
        {title} <span className="muted small">({count ?? venues.length})</span>
      </h2>
      <ul className="event-list">
        {venues.map((v) => (
          <li key={v.id} className="pass-row">
            <Link to="/app/venues/$venueId" params={{ venueId: v.id }} className="pass-name">
              {v.name}
            </Link>
            <span className={`badge status-${v.status}`}>{v.status}</span>
            <span className="muted small">
              {v.lastVerifiedAt ? `${Math.round(daysSince(v.lastVerifiedAt))}d since verified` : 'never verified'}
            </span>
            <span className="venue-confidence">{Math.round(v.confidence * 100)}%</span>
            <PassActions venue={v} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function PassActions({ venue }: { venue: VenueRow }) {
  const update = useResultMutation(client.venues.update)
  const setStatus = useResultMutation(client.venues.setStatus)

  return (
    <span className="pass-actions">
      <button
        className="link-button"
        disabled={update.state === 'pending'}
        onClick={() =>
          void update.mutate({ id: venue.id, lastVerifiedAt: new Date(), confidence: Math.max(venue.confidence, 0.9) })
        }
      >
        re-verify
      </button>
      <button
        className="link-button"
        disabled={setStatus.state === 'pending'}
        onClick={() => void setStatus.mutate({ id: venue.id, status: venue.status === 'live' ? 'closed' : 'live' })}
      >
        {venue.status === 'live' ? 'close' : 'reopen'}
      </button>
    </span>
  )
}

function MonthlyPass() {
  return (
    <ResultRpcHydrationBoundary state={Route.useLoaderData()}>
      <MonthlyPassInner />
    </ResultRpcHydrationBoundary>
  )
}

function MonthlyPassInner() {
  const [minConfidence, setMinConfidence] = useState('')
  const feed = useResultPaginatedQuery(client.venues.feed, {}, { staleTime: 60_000 })
  if (feed.state === 'pending') return <p className="muted">Loading…</p>
  if (feed.state === 'failure') return <p className="error">Failed: {feed.error._tag}</p>

  const all = feed.rows
  const confidenceFloor = minConfidence ? Number(minConfidence) : 0
  const due = all
    .filter((v) => v.status === 'live' && (daysSince(v.lastVerifiedAt) > VERIFY_AFTER_DAYS || v.confidence < confidenceFloor))
    .sort((a, b) => daysSince(b.lastVerifiedAt) - daysSince(a.lastVerifiedAt))
  const closed = all.filter((v) => v.status === 'closed')
  const added = all
    .filter((v) => v.source === 'editorial' && v.status !== 'closed')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Monthly pass</h1>
        <span className="muted small">manual editorial pass — digest email pending (ticket 12)</span>
      </div>
      <div className="venue-filters">
        <input
          type="number"
          min={0}
          max={1}
          step={0.1}
          value={minConfidence}
          onChange={(e) => setMinConfidence(e.target.value)}
          placeholder="min confidence (0–1)"
          aria-label="Minimum confidence"
        />
      </div>
      <QueueSection title="Due for verification" venues={due} />
      <QueueSection title="Closure candidates" venues={closed} />
      <QueueSection title="Recently added" venues={added.slice(0, 10)} count={added.length} />
    </>
  )
}
