/**
 * The venue feed, stats bar, add-venue form, and hotel list.
 *
 * No `"use client"` directive: Start is SSR, not RSC — every component
 * renders on the server AND hydrates on the client. The boundary that keeps
 * the database out of this file is `createServerFn` in ssr.ts.
 */
import { useState } from 'react'
import { useResultMutation, useResultPaginatedQuery, useResultQuery } from 'result-rpc/react'
import type { HotelRow, VenueRow } from '../models.js'
import { client } from '../rpc-client.js'

const StatusToggle = ({ venue }: { venue: VenueRow }) => {
  // The mutation output is the Venue ENTITY: the cache patches this row in
  // place — no refetch, no page splicing.
  const setStatus = useResultMutation(client.venues.setStatus)
  const next = venue.status === 'live' ? 'closed' : 'live'
  return (
    <button
      className="toggle"
      disabled={setStatus.state === 'pending'}
      onClick={() => setStatus.mutate({ id: venue.id, status: next })}
    >
      {venue.status === 'live' ? 'Mark closed' : 'Mark live'}
    </button>
  )
}

const VenueCard = ({ venue }: { venue: VenueRow }) => (
  <li className="card">
    <div className="card-head">
      <strong>{venue.name}</strong>
      <StatusToggle venue={venue} />
    </div>
    <span className="badge">{venue.category}</span>
    <span className="badge">{venue.neighborhood}</span>
    <span className={`badge status-${venue.status}`}>{venue.status}</span>
  </li>
)

export const VenueFeed = () => {
  // staleTime trusts the loader's prefetch for a minute: first mount makes
  // ZERO client requests — the whole point of prefetching.
  const feed = useResultPaginatedQuery(client.venues.feed, {}, { staleTime: 60_000 })
  if (feed.state === 'pending') return <p className="muted">Loading venues…</p>
  if (feed.state === 'failure') return <p className="error">Feed failed: {feed.error._tag}</p>
  return (
    <>
      <ul className="feed">
        {feed.rows.map((venue) => (
          <VenueCard key={venue.id} venue={venue} />
        ))}
      </ul>
      {feed.hasNext && (
        <button className="load-more" onClick={feed.fetchNext} disabled={feed.fetchingNext}>
          {feed.fetchingNext ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  )
}

export const StatsBar = () => {
  // One-off aggregate: no entity identity, kept fresh via `.affects()` on
  // the add/setStatus mutations.
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

export const AddVenueForm = () => {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('restaurant')
  const [neighborhood, setNeighborhood] = useState('Miðborg')
  const add = useResultMutation(client.venues.add, {
    onSuccess: () => setName(''),
  })
  return (
    <form
      className="add-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        add.mutate({ name: name.trim(), category, neighborhood })
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Venue name (unique)"
        aria-label="Venue name"
      />
      <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
        {['restaurant', 'cafe', 'bar', 'bakery', 'street-food'].map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <select
        value={neighborhood}
        onChange={(e) => setNeighborhood(e.target.value)}
        aria-label="Neighborhood"
      >
        {['Miðborg', 'Laugavegur', 'Hverfisgata', 'Þingholt', 'Grandi', 'Viðey'].map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
      <button type="submit" disabled={add.state === 'pending'}>
        Add
      </button>
      {add.state === 'failure' && (
        <span className="error">
          {add.error._tag === 'venue/name-taken'
            ? `"${add.error.data.name}" already exists`
            : `Failed: ${add.error._tag}`}
        </span>
      )}
    </form>
  )
}

export const HotelList = () => {
  const hotels = useResultQuery(client.hotels.list, {}, { staleTime: 60_000 })
  if (hotels.state === 'pending') return <p className="muted">Loading hotels…</p>
  if (hotels.state === 'failure') return <p className="error">Hotels failed: {hotels.error._tag}</p>
  if (hotels.value.length === 0) return <p className="muted">No hotels yet.</p>
  return (
    <div className="hotels">
      <h2>Hotels</h2>
      <ul>
        {hotels.value.map((hotel: HotelRow) => (
          <li key={hotel.id}>
            {hotel.name} — {hotel.roomCount} rooms · {hotel.pipelineStage}
          </li>
        ))}
      </ul>
    </div>
  )
}
