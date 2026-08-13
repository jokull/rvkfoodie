/**
 * Lifecycle events on a venue — closures/temporary closures/reopenings.
 * Adding one mechanically drives status + confidence server-side.
 */
import { useState } from 'react'
import { useResultMutation, useResultQuery } from 'result-rpc/react'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Button } from '@cloudflare/kumo/components/button'
import { Empty } from '@cloudflare/kumo/components/empty'
import { Input } from '@cloudflare/kumo/components/input'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Select } from '@cloudflare/kumo/components/select'
import { Surface } from '@cloudflare/kumo/components/surface'
import { Text } from '@cloudflare/kumo/components/text'
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
    <Surface render={<section />} className="mb-6 p-4">
      <Text variant="heading3" as="h2" DANGEROUS_className="mb-2">
        Lifecycle
      </Text>
      <form className="mb-3 flex flex-wrap gap-2" onSubmit={submit}>
        <Select
          size="sm"
          aria-label="Event type"
          value={type}
          onValueChange={(v) => v !== null && setType(v)}
          items={LIFECYCLE_TYPES.map((t) => ({ label: t, value: t as string }))}
        />
        <Input size="sm" type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} aria-label="Start date" />
        <Input size="sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
        <Button type="submit" variant="secondary" loading={add.state === 'pending'}>
          Record
        </Button>
        {add.state === 'failure' && (
          <Text variant="error" as="span">
            Failed: {add.error._tag}
          </Text>
        )}
      </form>
      {events.state === 'failure' ? (
        <Text variant="error">Failed: {events.error._tag}</Text>
      ) : events.state === 'pending' ? (
        <Loader size="sm" />
      ) : events.value.length === 0 ? (
        <Empty size="sm" title="No lifecycle events." />
      ) : (
        <ul className="flex flex-col gap-1">
          {events.value.map((ev) => (
            <li key={ev.id} className="flex items-center gap-2">
              <Badge variant={ev.type === 'closed' ? 'red' : ev.type === 'temporarily-closed' ? 'warning' : 'green'}>
                {ev.type}
              </Badge>
              <Text variant="secondary" size="sm" as="span">
                {fmt(ev.startedAt)}
              </Text>
              {ev.endedAt && (
                <Text variant="secondary" size="sm" as="span">
                  → {fmt(ev.endedAt)}
                </Text>
              )}
              {ev.note && (
                <Text variant="secondary" size="sm" as="span">
                  — {ev.note}
                </Text>
              )}
            </li>
          ))}
        </ul>
      )}
    </Surface>
  )
}
