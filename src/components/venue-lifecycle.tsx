/**
 * Lifecycle events on a venue — closures/temporary closures/reopenings.
 * Adding one mechanically drives status + confidence server-side.
 */
import { useState } from 'react'
import { useResultMutation, useResultQuery } from 'result-rpc/react'
import { client } from '../rpc-client.js'
import { LIFECYCLE_TYPES } from '../schema.js'

const fmt = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function VenueLifecycle({ venueId }: { venueId: string }) {
  const events = useResultQuery(client.venues.listLifecycle, { venueId }, { staleTime: 60_000 })
  const add = useResultMutation(client.venues.addLifecycleEvent, {
    onSuccess: () => setNote(''),
  })
  const [type, setType] = useState<string>(LIFECYCLE_TYPES[0])
  const [startedAt, setStartedAt] = useState(fmt(new Date()))
  const [note, setNote] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!startedAt) return
    add.mutate({
      venueId,
      type: type as (typeof LIFECYCLE_TYPES)[number],
      startedAt: new Date(startedAt),
      note: note.trim() || undefined,
    })
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Lifecycle</h2>
      <form className="lifecycle-form" onSubmit={submit}>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Event type">
          {LIFECYCLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} aria-label="Start date" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
        <button type="submit" disabled={add.state === 'pending'}>
          {add.state === 'pending' ? '…' : 'Record'}
        </button>
        {add.state === 'failure' && <span className="error">Failed: {add.error._tag}</span>}
      </form>
      {events.state === 'failure' ? (
        <p className="error">Failed: {events.error._tag}</p>
      ) : events.state === 'pending' ? (
        <p className="muted small">…</p>
      ) : events.value.length === 0 ? (
        <p className="muted small">No lifecycle events.</p>
      ) : (
        <ul className="event-list">
          {events.value.map((ev) => (
            <li key={ev.id}>
              <span className={`badge lifecycle-${ev.type}`}>{ev.type}</span>
              <span className="muted small">{fmt(ev.startedAt)}</span>
              {ev.endedAt && <span className="muted small">→ {fmt(ev.endedAt)}</span>}
              {ev.note && <span className="muted small">— {ev.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
