/**
 * Awards on a venue — the editor's-pick source for guide pages. One award
 * per (venue, type); duplicates are rejected server-side.
 */
import { useState } from 'react'
import { useResultMutation, useResultQuery } from 'result-rpc/react'
import { client } from '../rpc-client.js'

export function VenueAwards({ venueId }: { venueId: string }) {
  const awards = useResultQuery(client.venueAwards.list, { venueId }, { staleTime: 60_000 })
  const add = useResultMutation(client.venueAwards.add, {
    onSuccess: () => setTitle(''),
  })
  const remove = useResultMutation(client.venueAwards.remove)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    add.mutate({
      venueId,
      awardType: 'grapevine-best-of',
      title: title.trim(),
      url: url.trim() || undefined,
    })
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Awards</h2>
      <form className="lifecycle-form" onSubmit={submit}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Best Bakery 2025" aria-label="Award title" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (optional)" aria-label="Award URL" />
        <button type="submit" disabled={add.state === 'pending'}>
          {add.state === 'pending' ? '…' : 'Add'}
        </button>
        {add.state === 'failure' && (
          <span className="error">
            {add.error._tag === 'venue-award/exists' ? 'Already awarded this type' : `Failed: ${add.error._tag}`}
          </span>
        )}
      </form>
      {awards.state === 'failure' ? (
        <p className="error">Failed: {awards.error._tag}</p>
      ) : awards.state === 'pending' ? (
        <p className="muted small">…</p>
      ) : awards.value.length === 0 ? (
        <p className="muted small">No awards yet.</p>
      ) : (
        <ul className="event-list">
          {awards.value.map((a) => (
            <li key={a.id}>
              <span className="badge badge-pick">grapevine-best-of</span>
              <strong>{a.title}</strong>
              {a.url && (
                <a href={a.url} target="_blank" rel="noreferrer" className="muted small">
                  source
                </a>
              )}
              <button
                className="link-button"
                onClick={() => remove.mutate({ id: a.id })}
                disabled={remove.state === 'pending'}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
