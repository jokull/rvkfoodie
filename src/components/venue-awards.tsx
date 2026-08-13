/**
 * Awards on a venue — the editor's-pick source for guide pages. One award
 * per (venue, type); duplicates are rejected server-side.
 */
import { useState } from 'react'
import { useResultMutation, useResultQuery } from 'result-rpc/react'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Button } from '@cloudflare/kumo/components/button'
import { Empty } from '@cloudflare/kumo/components/empty'
import { Input } from '@cloudflare/kumo/components/input'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Surface } from '@cloudflare/kumo/components/surface'
import { Text } from '@cloudflare/kumo/components/text'
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
    <Surface render={<section />} className="mb-6 p-4">
      <Text variant="heading3" as="h2" DANGEROUS_className="mb-2">
        Awards
      </Text>
      <form className="mb-3 flex flex-wrap gap-2" onSubmit={submit}>
        <Input
          size="sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Best Bakery 2025"
          aria-label="Award title"
        />
        <Input
          size="sm"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… (optional)"
          aria-label="Award URL"
        />
        <Button type="submit" variant="primary" loading={add.state === 'pending'}>
          Add
        </Button>
        {add.state === 'failure' && (
          <Text variant="error" as="span">
            {add.error._tag === 'venue-award/exists' ? 'Already awarded this type' : `Failed: ${add.error._tag}`}
          </Text>
        )}
      </form>
      {awards.state === 'failure' ? (
        <Text variant="error">Failed: {awards.error._tag}</Text>
      ) : awards.state === 'pending' ? (
        <Loader size="sm" />
      ) : awards.value.length === 0 ? (
        <Empty size="sm" title="No awards yet." />
      ) : (
        <ul className="flex flex-col gap-1">
          {awards.value.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <Badge variant="warning">grapevine-best-of</Badge>
              <strong>{a.title}</strong>
              {a.url && (
                <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-kumo-subtle">
                  source
                </a>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                disabled={remove.state === 'pending'}
                onClick={() => remove.mutate({ id: a.id })}
              >
                remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  )
}
