/**
 * Venue inventory — the full list with status/category filters + search,
 * and an add-venue dialog. Filtering is client-side over the prefetched
 * feed (PAGE_SIZE 50 covers the whole inventory).
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ResultRpcHydrationBoundary, useResultPaginatedQuery } from 'result-rpc/react'
import { AddVenueDialog } from '../components/add-venue-dialog.js'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Button } from '@cloudflare/kumo/components/button'
import { Empty } from '@cloudflare/kumo/components/empty'
import { Input } from '@cloudflare/kumo/components/input'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Select } from '@cloudflare/kumo/components/select'
import type { VenueRow } from '../models.js'
import { client } from '../rpc-client.js'
import { VENUE_CATEGORIES } from '../schema.js'
import { prefetchVenues } from '../ssr.js'

export const Route = createFileRoute('/app/venues')({
  loader: () => prefetchVenues(),
  component: Venues,
})

const STATUSES = ['all', 'live', 'draft', 'closed'] as const

const STATUS_BADGE_VARIANTS: Record<string, 'green' | 'red' | 'neutral'> = {
  live: 'green',
  closed: 'red',
  draft: 'neutral',
}

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

  if (feed.state === 'pending') return <Loader />
  if (feed.state === 'failure') return <p className="text-sm text-rose-600">Feed failed: {feed.error._tag}</p>

  const rows = feed.rows.filter(
    (v: VenueRow) =>
      (status === 'all' || v.status === status) &&
      (category === 'all' || v.category === category) &&
      (q.trim() === '' || `${v.name} ${v.address} ${v.cuisine ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  )

  return (
    <>
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Venues</h1>
        <span className="text-sm text-slate-500">{rows.length} shown</span>
        <Button variant="primary" className="ml-auto" onClick={() => setAddOpen(true)}>
          Add venue
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, address, cuisine…"
          aria-label="Search venues"
          size="sm"
          className="w-72"
        />
        <Select value={status} onValueChange={(v) => v !== null && setStatus(v)} aria-label="Status filter" size="sm">
          {STATUSES.map((s) => (
            <Select.Option key={s} value={s}>
              {s}
            </Select.Option>
          ))}
        </Select>
        <Select value={category} onValueChange={(v) => v !== null && setCategory(v)} aria-label="Category filter" size="sm">
          <Select.Option value="all">all categories</Select.Option>
          {VENUE_CATEGORIES.map((c) => (
            <Select.Option key={c} value={c}>
              {c}
            </Select.Option>
          ))}
        </Select>
      </div>
      {rows.length === 0 ? (
        <Empty title="No venues match" description="Try adjusting the search or filters." />
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((v) => {
            const img = photoUrl(v.photos)
            return (
              <li key={v.id}>
                <Link to="/app/venues/$venueId" params={{ venueId: v.id }} className="flex items-center gap-3 rounded-lg px-2 py-2 no-underline hover:bg-slate-50">
                  {img ? <img className="h-10 w-10 shrink-0 rounded-md object-cover" src={img} alt="" loading="lazy" /> : <span className="h-10 w-10 shrink-0 rounded-md object-cover bg-slate-100" />}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <strong className="truncate text-sm font-medium text-slate-900">{v.name}</strong>
                    <span className="text-sm text-slate-500">
                      {v.address}
                      {v.openingHours ? ` · ${v.openingHours}` : ''}
                    </span>
                  </span>
                  <Badge variant={STATUS_BADGE_VARIANTS[v.status] ?? 'neutral'}>{v.status}</Badge>
                  <Badge variant="secondary">{v.category}</Badge>
                  <span className="w-10 text-right text-xs tabular-nums text-slate-500" title="Editorial confidence">
                    {Math.round(v.confidence * 100)}%
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <AddVenueDialog open={addOpen} onClose={() => setAddOpen(false)} />
      {feed.hasNext && (
        <Button variant="secondary" className="mt-3" onClick={feed.fetchNext} loading={feed.fetchingNext}>
          Load more
        </Button>
      )}
    </>
  )
}
