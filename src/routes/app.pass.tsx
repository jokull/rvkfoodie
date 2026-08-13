/**
 * Monthly pass — the editorial review queue over the full inventory:
 * due-for-verification (stale lastVerifiedAt / low confidence), closure
 * candidates (closed or temporarily-closed via lifecycle), and recently
 * added venues. Actions re-verify, mark closed/live, and adjust
 * confidence — all existing venue mutations (entity patches keep rows in
 * sync). The hotel digest email is the remaining ticket-12 artifact.
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '@cloudflare/kumo/components/button'
import { Input } from '@cloudflare/kumo/components/input'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Surface } from '@cloudflare/kumo/components/surface'
import { Meter } from '@cloudflare/kumo/components/meter'
import { useState } from 'react'
import { ResultRpcHydrationBoundary, useResultMutation, useResultPaginatedQuery } from 'result-rpc/react'
import { DigestResult, type VenueRow } from '../models.js'
import type { InputOf } from 'result-rpc'
import { client } from '../rpc-client.js'
import { prefetchVenues } from '../ssr.js'

export const Route = createFileRoute('/app/pass')({
  loader: () => prefetchVenues(),
  component: MonthlyPass,
})

const VERIFY_AFTER_DAYS = 120

const daysSince = (d: Date | null): number => (d ? (Date.now() - new Date(d).getTime()) / 86_400_000 : Infinity)

const statusVariant = (status: string): 'success' | 'warning' | 'neutral' =>
  status === 'live' ? 'success' : status === 'closed' ? 'neutral' : 'warning'

function QueueSection({ title, venues, count }: { title: string; venues: VenueRow[]; count?: number }) {
  if (venues.length === 0) return null
  return (
    <section className="mb-6 rounded-lg border border-slate-200 p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">
        {title} <span className="text-sm text-slate-500">({count ?? venues.length})</span>
      </h2>
      <div className="flex flex-col gap-2">
        {venues.map((v) => (
          <Surface key={v.id} className="flex flex-row flex-wrap items-center gap-3 p-3">
            <Link to="/app/venues/$venueId" params={{ venueId: v.id }} className="font-medium text-kumo-link">
              {v.name}
            </Link>
            <Badge variant={statusVariant(v.status)}>{v.status}</Badge>
            <span className="text-sm text-slate-500">
              {v.lastVerifiedAt ? `${Math.round(daysSince(v.lastVerifiedAt))}d since verified` : 'never verified'}
            </span>
            <Meter label="Confidence" value={Math.round(v.confidence * 100)} className="w-44" />
            <PassActions venue={v} />
          </Surface>
        ))}
      </div>
    </section>
  )
}

function PassActions({ venue }: { venue: VenueRow }) {
  const update = useResultMutation(client.venues.update)
  const setStatus = useResultMutation(client.venues.setStatus)

  return (
    <span className="ml-auto flex gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={update.state === 'pending'}
        onClick={() =>
          void update.mutate({ id: venue.id, lastVerifiedAt: new Date(), confidence: Math.max(venue.confidence, 0.9) })
        }
      >
        re-verify
      </Button>
      <Button
        size="sm"
        variant={venue.status === 'live' ? 'secondary-destructive' : 'secondary'}
        disabled={setStatus.state === 'pending'}
        onClick={() => void setStatus.mutate({ id: venue.id, status: venue.status === 'live' ? 'closed' : 'live' })}
      >
        {venue.status === 'live' ? 'close' : 'reopen'}
      </Button>
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
  const [digestOut, setDigestOut] = useState<InputOf<typeof DigestResult> | null>(null)
  const digest = useResultMutation(client.guides.digest, {
    onSuccess: (value) => setDigestOut(value),
  })
  const feed = useResultPaginatedQuery(client.venues.feed, {}, { staleTime: 60_000 })
  if (feed.state === 'pending')
    return (
      <div className="flex items-center gap-2">
        <Loader size="sm" />
        <span className="text-sm text-slate-500">Loading…</span>
      </div>
    )
  if (feed.state === 'failure') return <p className="text-sm text-rose-600">Failed: {feed.error._tag}</p>

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
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Monthly pass</h1>
        <span className="text-sm text-slate-500">manual editorial pass — digest email pending (ticket 12)</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          type="number"
          min={0}
          max={1}
          step={0.1}
          value={minConfidence}
          onChange={(e) => setMinConfidence(e.target.value)}
          placeholder="min confidence (0–1)"
          aria-label="Minimum confidence"
        />
        <Button variant="primary" onClick={() => void digest.mutate({})} loading={digest.state === 'pending'}>
          Send digest
        </Button>
      </div>
      {digest.state === 'failure' && <p className="text-sm text-rose-600">Digest failed: {digest.error._tag}</p>}
      {digestOut && (
        <Surface className="mb-6 p-3">
          {digestOut.map((d) => (
            <div key={d.guideId} className="flex flex-wrap items-center gap-3 border-b border-kumo-fill py-2 last:border-b-0">
              <span className="font-medium text-kumo-default">/{d.slug}</span>
              <span className="text-sm text-slate-500">
                {d.skipped
                  ? 'baseline snapshotted'
                  : d.added.length === 0 && d.removed.length === 0
                    ? 'no changes'
                    : `+${d.added.length} −${d.removed.length}`}
              </span>
              <span className="text-sm text-slate-500">{d.emailed.length > 0 ? `emailed ${d.emailed.join(', ')}` : ''}</span>
            </div>
          ))}
        </Surface>
      )}
      <QueueSection title="Due for verification" venues={due} />
      <QueueSection title="Closure candidates" venues={closed} />
      <QueueSection title="Recently added" venues={added.slice(0, 10)} count={added.length} />
    </>
  )
}
