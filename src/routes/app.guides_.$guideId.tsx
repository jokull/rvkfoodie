/**
 * The guide builder — drafting-engine run, snapshot review (reorder / pin /
 * override / exclude), approve pending, publish. Reordering moves orderKeys
 * between neighbors (fractional-indexing); every row edit invalidates the
 * builder + public view via .affects().
 */
import { Link, createFileRoute } from '@tanstack/react-router'
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

  if (builder.state === 'pending') return <p className="muted">Loading…</p>
  if (builder.state === 'failure')
    return <p className="error">{builder.error._tag === 'guide/not-found' ? 'Guide not found.' : `Failed: ${builder.error._tag}`}</p>

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
      <p className="muted small">
        <Link to="/app/guides">← all guides</Link>
      </p>
      <div className="page-head">
        <h1 className="page-title">/{guide.slug}</h1>
        <span className={`badge status-${guide.status}`}>{guide.status}</span>
        <span className="muted small">
          {live.length} live · {pending.length} pending
        </span>
      </div>

      <section className="panel">
        <h2 className="panel-title">Config</h2>
        <div className="lifecycle-form">
          <input
            type="number"
            min={1}
            max={120}
            placeholder={`radius ${guide.radiusMin} min`}
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            aria-label="Radius in walk minutes"
          />
          <input
            type="number"
            min={1}
            max={60}
            placeholder={`target ${guide.targetCount}`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Target venue count"
          />
          <button
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
          </button>
          <button
            onClick={() => void draft.mutate({ id: guideId })}
            disabled={draft.state === 'pending'}
          >
            {draft.state === 'pending' ? 'Drafting…' : 'Run draft'}
          </button>
          <button
            onClick={() => void approve.mutate({ guideId, venueIds: pending.map((r) => r.venueId) })}
            disabled={pending.length === 0 || approve.state === 'pending'}
          >
            Approve {pending.length > 0 ? `(${pending.length})` : ''}
          </button>
          {guide.status !== 'live' && (
            <button
              onClick={() => void publish.mutate({ id: guideId })}
              disabled={live.length === 0 || publish.state === 'pending'}
            >
              Publish
            </button>
          )}
        </div>
        {draft.state === 'success' && (
          <p className="saved">
            Draft: +{draft.value.added.length} added, {draft.value.dropped.length} dropped (closed)
          </p>
        )}
        {updateRow.state === 'failure' && <p className="error">Row update failed: {updateRow.error._tag}</p>}
      </section>

      {excludes.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">Excluded venues</h2>
          <ul className="event-list">
            {excludes.map((e) => (
              <li key={e.venueId}>
                <span className="muted small">{e.name}</span>
                <button className="link-button" onClick={() => void unexclude.mutate({ guideId, venueId: e.venueId })}>
                  unexclude
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 ? (
        <p className="muted">No rows yet — run a draft.</p>
      ) : (
        VENUE_CATEGORIES.filter((c) => byCategory.has(c)).map((category) => {
          const list = byCategory.get(category)!
          return (
            <section key={category} className="panel">
              <h2 className="panel-title">{sectionTitle(category)}</h2>
              <ul className="event-list">
                {list.map((row, index) => (
                  <li key={row.id} className="builder-row">
                    <div className="builder-row-main">
                      <span className={`badge status-${row.status}`}>{row.status}</span>
                      <strong>{row.venue.name}</strong>
                      {row.pinned && <span className="badge badge-pick">pinned</span>}
                      <span className="muted small">{Math.round(row.venue.confidence * 100)}%</span>
                    </div>
                    <div className="builder-row-actions">
                      <button className="icon-button" onClick={() => move(index, -1, list)} aria-label="Move up">
                        ↑
                      </button>
                      <button className="icon-button" onClick={() => move(index, 1, list)} aria-label="Move down">
                        ↓
                      </button>
                      <button
                        className="link-button"
                        onClick={() => void updateRow.mutate({ id: row.id, pinned: !row.pinned })}
                      >
                        {row.pinned ? 'unpin' : 'pin'}
                      </button>
                      <button className="link-button" onClick={() => void exclude.mutate({ guideId, venueId: row.venueId })}>
                        exclude
                      </button>
                      <input
                        className="override-input"
                        value={overrides[row.id] ?? row.overrideText ?? ''}
                        placeholder="override text…"
                        onChange={(e) => setOverrides((o) => ({ ...o, [row.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveOverride(row)
                        }}
                        aria-label={`${row.venue.name} override text`}
                      />
                      {(overrides[row.id] ?? '') !== (row.overrideText ?? '') && (
                        <button className="link-button" onClick={() => saveOverride(row)}>
                          save
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
