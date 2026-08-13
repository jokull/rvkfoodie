/**
 * Venue detail — the full CRUD surface: summary, edit form, status toggle,
 * lifecycle, awards, audit trail. Mutations return Venue entities, so the
 * cache patches in place; the audit list is invalidated explicitly after
 * each write.
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { ResultRpcHydrationBoundary, useResultMutation, useResultQuery, useResultRuntime } from 'result-rpc/react'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Button } from '@cloudflare/kumo/components/button'
import { Empty } from '@cloudflare/kumo/components/empty'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Surface } from '@cloudflare/kumo/components/surface'
import { Text } from '@cloudflare/kumo/components/text'
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
  if (audit.state === 'failure') return <Text variant="error">Audit failed: {audit.error._tag}</Text>
  if (audit.state === 'pending') return <Loader size="sm" />
  if (audit.value.length === 0) return <Empty size="sm" title="No audit entries." />
  return (
    <ul className="flex flex-col gap-1">
      {audit.value.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-baseline gap-2 text-sm">
          <Text variant="secondary" size="sm" as="span">
            {new Date(entry.at).toISOString().slice(0, 16).replace('T', ' ')}
          </Text>
          <Text variant="mono" as="code" DANGEROUS_className="rounded bg-slate-100 px-1 text-xs">
            {entry.actor}
          </Text>
          <Text as="span">{entry.action}</Text>
          {entry.after && (
            <Text variant="secondary" size="sm" as="span">
              {entry.after.slice(0, 140)}
            </Text>
          )}
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

  if (venue.state === 'pending') return <Loader size="lg" />
  if (venue.state === 'failure')
    return (
      <Text variant="error">
        {venue.error._tag === 'venue/not-found' ? 'Venue not found.' : `Failed: ${venue.error._tag}`}
      </Text>
    )

  const v = venue.value
  const img = photoUrl(v.photos)
  const next = v.status === 'live' ? 'closed' : 'live'
  return (
    <div>
      <Text variant="secondary" size="sm" as="p">
        <Link to="/app/venues">← all venues</Link>
      </Text>
      <div className="mb-6 flex gap-4">
        {img && <img className="h-24 w-24 shrink-0 rounded-lg object-cover" src={img} alt={v.name} />}
        <div>
          <h1 className="text-xl font-semibold">{v.name}</h1>
          <div className="mb-1 flex flex-wrap gap-1.5">
            <Badge variant={v.status === 'live' ? 'green' : v.status === 'closed' ? 'red' : 'neutral'}>{v.status}</Badge>
            <Badge variant="secondary">{v.category}</Badge>
            {v.categorySecondary && <Badge variant="secondary">{v.categorySecondary}</Badge>}
            {v.cuisine && <Badge variant="secondary">{v.cuisine}</Badge>}
            <span title="Editorial confidence">
              <Badge variant="secondary">{Math.round(v.confidence * 100)}%</Badge>
            </span>
          </div>
          <Text variant="secondary" size="sm" as="p">
            {v.address}
            {v.openingHours ? ` · ${v.openingHours}` : ''}
            {v.website ? ` · ${v.website}` : ''}
            {v.phone ? ` · ${v.phone}` : ''}
          </Text>
          <Button
            type="button"
            variant={next === 'live' ? 'secondary' : 'secondary-destructive'}
            loading={setStatus.state === 'pending'}
            onClick={() => setStatus.mutate({ id: v.id, status: next })}
          >
            {next === 'live' ? 'Mark live' : 'Mark closed'}
          </Button>
        </div>
      </div>
      <VenueEditForm venue={v} />
      <VenuePhotos venueId={v.id} photos={v.photos} />
      <VenueLifecycle venueId={v.id} />
      <VenueAwards venueId={v.id} />
      <Surface render={<section />} className="mb-6 p-4">
        <Text variant="heading3" as="h2" DANGEROUS_className="mb-2">
          Audit trail
        </Text>
        <AuditTrail venueId={v.id} />
      </Surface>
    </div>
  )
}
