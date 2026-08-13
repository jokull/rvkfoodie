/**
 * Guide builder — the list of guides with their hotel + status, and a
 * create-a-guide picker for hotels without one.
 */
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { Select } from '@cloudflare/kumo/components/select'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Table } from '@cloudflare/kumo/components/table'
import { useState } from 'react'
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
  const [hotelPick, setHotelPick] = useState<string | null>(null)
  const guides = useResultQuery(client.guides.list, {}, { staleTime: 60_000 })
  const hotels = useResultQuery(client.hotels.list, {}, { staleTime: 60_000 })
  const create = useResultMutation(client.guides.create, {
    onSuccess: (guide) =>
      void router.navigate({ to: '/app/guides/$guideId', params: { guideId: guide.id } }),
  })

  if (guides.state === 'pending' || hotels.state === 'pending')
    return (
      <div className="flex items-center gap-2">
        <Loader size="sm" />
        <span className="text-sm text-slate-500">Loading…</span>
      </div>
    )
  if (guides.state === 'failure' || hotels.state === 'failure') return <p className="text-sm text-rose-600">Failed to load guides.</p>

  const byHotel = new Map(guides.value.map((g) => [g.hotelId, g]))
  const hotelName = new Map(hotels.value.map((h) => [h.id, h.name]))
  const without = hotels.value.filter((h) => !byHotel.has(h.id))

  return (
    <>
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Guide builder</h1>
      </div>
      {guides.value.length > 0 && (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Guide</Table.Head>
              <Table.Head>Status</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {guides.value.map((g) => (
              <Table.Row
                key={g.id}
                className="cursor-pointer hover:bg-kumo-tint"
                onClick={() => void router.navigate({ to: '/app/guides/$guideId', params: { guideId: g.id } })}
              >
                <Table.Cell>
                  <Link
                    to="/app/guides/$guideId"
                    params={{ guideId: g.id }}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-kumo-link"
                  >
                    {hotelName.get(g.hotelId) ?? g.slug}
                  </Link>{' '}
                  <span className="text-sm text-slate-500">/{g.slug}</span>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant={g.status === 'live' ? 'success' : 'warning'}>{g.status}</Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
      {without.length > 0 && (
        <section className="mb-6 rounded-lg border border-slate-200 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Hotels without a guide</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <Select
              aria-label="Hotel"
              value={hotelPick}
              placeholder="Choose a hotel…"
              onValueChange={(id) => {
                if (id) void create.mutate({ hotelId: id })
                setHotelPick(null)
              }}
              items={without.map((h) => ({ label: h.name, value: h.id }))}
            />
            {create.state === 'failure' && <span className="text-sm text-rose-600">Failed: {create.error._tag}</span>}
          </div>
        </section>
      )}
    </>
  )
}
