/**
 * The guide builder — drafting-engine run, snapshot review (reorder / pin /
 * override / exclude), approve pending, publish. Reordering moves orderKeys
 * between neighbors (fractional-indexing); every row edit invalidates the
 * builder + public view via .affects().
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '@cloudflare/kumo/components/button'
import { Input } from '@cloudflare/kumo/components/input'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Empty } from '@cloudflare/kumo/components/empty'
import { Surface } from '@cloudflare/kumo/components/surface'
import { generateKeyBetween } from 'fractional-indexing'
import { useState } from 'react'
import { ResultRpcHydrationBoundary, useResultMutation, useResultQuery } from 'result-rpc/react'
import type { GuideBuilderRow } from '../models.js'
import { client } from '../rpc-client.js'
import { VENUE_CATEGORIES } from '../schema.js'
import { prefetchGuideBuilder } from '../ssr.js'

export const Route = createFileRoute('/app/guides_/$guideId')({
  loader: ({ params }) => prefetchGuideBuilder({ data: { id: params.guideId } }),
  component: GuideBuilder,
})

function GuideBuilder() {
  return (
    <ResultRpcHydrationBoundary state={Route.useLoaderData()}>
      <GuideBuilderInner />
    </ResultRpcHydrationBoundary>
  )
}

const sectionTitle = (category: string): string => {
  const labels: Record<string, string> = {
    'breakfast-brunch': 'Breakfast & brunch',
    cafe: 'Cafés',
    bakery: 'Bakeries',
    restaurant: 'Restaurants',
    bar: 'Bars & nightlife',
    'street-food': 'Street food',
    'sweet-treats': 'Sweet treats',
  }
  return labels[category] ?? category
}

function GuideBuilderInner() {
  const { guideId } = Route.useParams()
  const builder = useResultQuery(client.guides.builder, { guideId }, { staleTime: 60_000 })
  const draft = useResultMutation(client.guides.draft)
  const approve = useResultMutation(client.guides.approveCandidates)
  const publish = useResultMutation(client.guides.publish)
  const setConfig = useResultMutation(client.guides.setConfig)
  const updateRow = useResultMutation(client.guideVenues.update)
  const exclude = useResultMutation(client.guides.addExclude)
  const unexclude = useResultMutation(client.guides.removeExclude)
  const [radius, setRadius] = useState('')
  const [target, setTarget] = useState('')
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  if (builder.state === 'pending')
    return (
      <div className="flex items-center gap-2">
        <Loader size="sm" />
        <span className="text-sm text-slate-500">Loading…</span>
      </div>
    )
  if (builder.state === 'failure')
    return <p className="text-sm text-rose-600">{builder.error._tag === 'guide/not-found' ? 'Guide not found.' : `Failed: ${builder.error._tag}`}</p>

  const { guide, rows, excludes } = builder.value
  const pending = rows.filter((r) => r.status === 'pending')
  const live = rows.filter((r) => r.status === 'live')
  const byCategory = new Map<string, GuideBuilderRow[]>()
  for (const row of rows) {
    const list = byCategory.get(row.venue.category) ?? []
    list.push(row)
    byCategory.set(row.venue.category, list)
  }

  const move = (index: number, dir: -1 | 1, list: GuideBuilderRow[]) => {
    const row = list[index]
    if (!row) return
    const neighbor = list[index + dir]
    if (!neighbor) return
    const beyond = list[index + dir * 2]
    const newKey =
      dir === -1
        ? generateKeyBetween(beyond?.orderKey ?? null, row.orderKey)
        : generateKeyBetween(row.orderKey, beyond?.orderKey ?? null)
    void updateRow.mutate({ id: row.id, orderKey: newKey })
  }

  const saveOverride = (row: GuideBuilderRow) => {
    const text = overrides[row.id]?.trim()
    void updateRow.mutate({ id: row.id, overrideText: text === '' ? null : text })
    setOverrides((o) => {
      const next = { ...o }
      delete next[row.id]
      return next
    })
  }

  return (
    <div>
      <p className="text-sm text-slate-500">
        <Link to="/app/guides">← all guides</Link>
      </p>
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">/{guide.slug}</h1>
        <Badge variant={guide.status === 'live' ? 'success' : 'warning'}>{guide.status}</Badge>
        <span className="text-sm text-slate-500">
          {live.length} live · {pending.length} pending
        </span>
      </div>

      <section className="mb-6 rounded-lg border border-slate-200 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Config</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            type="number"
            min={1}
            max={120}
            placeholder={`radius ${guide.radiusMin} min`}
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            aria-label="Radius in walk minutes"
          />
          <Input
            type="number"
            min={1}
            max={60}
            placeholder={`target ${guide.targetCount}`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Target venue count"
          />
          <Button
            variant="secondary"
            onClick={() => {
              void setConfig.mutate({
                guideId,
                radiusMin: radius ? Number(radius) : undefined,
                targetCount: target ? Number(target) : undefined,
              })
              setRadius('')
              setTarget('')
            }}
          >
            Save config
          </Button>
          <Button variant="secondary" loading={draft.state === 'pending'} onClick={() => void draft.mutate({ id: guideId })}>
            Run draft
          </Button>
          <Button
            variant="secondary"
            loading={approve.state === 'pending'}
            disabled={pending.length === 0}
            onClick={() => void approve.mutate({ guideId, venueIds: pending.map((r) => r.venueId) })}
          >
            Approve {pending.length > 0 ? `(${pending.length})` : ''}
          </Button>
          {guide.status !== 'live' && (
            <Button
              variant="primary"
              loading={publish.state === 'pending'}
              disabled={live.length === 0}
              onClick={() => void publish.mutate({ id: guideId })}
            >
              Publish
            </Button>
          )}
        </div>
        {draft.state === 'success' && (
          <p className="text-sm text-emerald-600">
            Draft: +{draft.value.added.length} added, {draft.value.dropped.length} dropped (closed)
          </p>
        )}
        {updateRow.state === 'failure' && <p className="text-sm text-rose-600">Row update failed: {updateRow.error._tag}</p>}
      </section>

      {excludes.length > 0 && (
        <section className="mb-6 rounded-lg border border-slate-200 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Excluded venues</h2>
          <ul className="flex flex-col gap-1">
            {excludes.map((e) => (
              <li key={e.venueId} className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-500">{e.name}</span>
                <Button size="sm" variant="ghost" onClick={() => void unexclude.mutate({ guideId, venueId: e.venueId })}>
                  unexclude
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 ? (
        <Empty size="sm" title="No rows yet — run a draft." />
      ) : (
        VENUE_CATEGORIES.filter((c) => byCategory.has(c)).map((category) => {
          const list = byCategory.get(category)!
          return (
            <section key={category} className="mb-6 rounded-lg border border-slate-200 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{sectionTitle(category)}</h2>
              <div className="flex flex-col gap-2">
                {list.map((row, index) => (
                  <Surface key={row.id} className="flex flex-col gap-2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={row.status === 'live' ? 'success' : 'secondary'}>{row.status}</Badge>
                      <strong>{row.venue.name}</strong>
                      {row.pinned && <Badge variant="warning">pinned</Badge>}
                      <span className="text-sm text-slate-500">{Math.round(row.venue.confidence * 100)}%</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => move(index, -1, list)} aria-label="Move up">
                        ↑
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => move(index, 1, list)} aria-label="Move down">
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void updateRow.mutate({ id: row.id, pinned: !row.pinned })}
                      >
                        {row.pinned ? 'unpin' : 'pin'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void exclude.mutate({ guideId, venueId: row.venueId })}
                      >
                        exclude
                      </Button>
                      <Input
                        size="sm"
                        className="w-48"
                        value={overrides[row.id] ?? row.overrideText ?? ''}
                        placeholder="override text…"
                        onChange={(e) => setOverrides((o) => ({ ...o, [row.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveOverride(row)
                        }}
                        aria-label={`${row.venue.name} override text`}
                      />
                      {(overrides[row.id] ?? '') !== (row.overrideText ?? '') && (
                        <Button size="sm" variant="ghost" onClick={() => saveOverride(row)}>
                          save
                        </Button>
                      )}
                    </div>
                  </Surface>
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
