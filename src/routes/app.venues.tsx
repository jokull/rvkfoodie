/**
 * Venue inventory — the full list with status/category filters + search,
 * and an add-venue dialog. Filtering is client-side over the prefetched
 * feed (PAGE_SIZE 50 covers the whole inventory).
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ResultRpcHydrationBoundary, useResultPaginatedQuery } from 'result-rpc/react'
import { AddVenueDialog } from '../components/add-venue-dialog.js'
import type { VenueRow } from '../models.js'
import { client } from '../rpc-client.js'
import { VENUE_CATEGORIES } from '../schema.js'
import { prefetchVenues } from '../ssr.js'

export const Route = createFileRoute('/app/venues')({
  loader: () => prefetchVenues(),
  component: Venues,
})

const STATUSES = ['all', 'live', 'draft', 'closed'] as const

const photoUrl = (photos: readonly string[]): string | null => {
  const p = photos[0]
  if (!p) return null
  return p.replace(/^(https?:\/\/media\.rvkfoodie\.is)\/?(.*)$/, '$1/cdn-cgi/image/width=120,fit=scale-down,format=webp/$2')
}

function Venues() {
  return (
    <ResultRpcHydrationBoundary state={Route.useLoaderData()}>
      <VenuesInner />
    </ResultRpcHydrationBoundary>
  )
}

function VenuesInner() {
  const [status, setStatus] = useState<string>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [category, setCategory] = useState<string>('all')
  const [q, setQ] = useState('')
  const feed = useResultPaginatedQuery(client.venues.feed, {}, { staleTime: 60_000 })

  if (feed.state === 'pending') return <p className="muted">Loading venues…</p>
  if (feed.state === 'failure') return <p className="error">Feed failed: {feed.error._tag}</p>

  const rows = feed.rows.filter(
    (v: VenueRow) =>
      (status === 'all' || v.status === status) &&
      (category === 'all' || v.category === category) &&
      (q.trim() === '' || `${v.name} ${v.address} ${v.cuisine ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  )

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Venues</h1>
        <span className="muted">{rows.length} shown</span>
        <button className="add-button" onClick={() => setAddOpen(true)}>
          Add venue
        </button>
      </div>
      <div className="venue-filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, address, cuisine…" aria-label="Search venues" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category filter">
          <option value="all">all categories</option>
          {VENUE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <ul className="venue-list">
        {rows.map((v) => {
          const img = photoUrl(v.photos)
          return (
            <li key={v.id}>
              <Link to="/app/venues/$venueId" params={{ venueId: v.id }} className="venue-row">
                {img ? <img className="venue-thumb" src={img} alt="" loading="lazy" /> : <span className="venue-thumb venue-thumb-empty" />}
                <span className="venue-row-body">
                  <strong>{v.name}</strong>
                  <span className="muted small">
                    {v.address}
                    {v.openingHours ? ` · ${v.openingHours}` : ''}
                  </span>
                </span>
                <span className={`badge status-${v.status}`}>{v.status}</span>
                <span className="badge">{v.category}</span>
                <span className="venue-confidence" title="Editorial confidence">
                  {Math.round(v.confidence * 100)}%
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <AddVenueDialog open={addOpen} onClose={() => setAddOpen(false)} />
      {feed.hasNext && (
        <button className="load-more" onClick={feed.fetchNext} disabled={feed.fetchingNext}>
          {feed.fetchingNext ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  )
}
