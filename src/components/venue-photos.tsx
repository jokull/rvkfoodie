/**
 * Photo manager on the venue detail. Uploads stream to /api/upload
 * (session cookie rides the same-origin request) and the returned URL is
 * added to the venue's photos via updateVenue — the same entity mutation
 * the edit form uses, so the cache patches everywhere.
 */
import { useRef, useState } from 'react'
import { useResultMutation } from 'result-rpc/react'
import { Button } from '@cloudflare/kumo/components/button'
import { Loader } from '@cloudflare/kumo/components/loader'
import { Surface } from '@cloudflare/kumo/components/surface'
import { Text } from '@cloudflare/kumo/components/text'
import { client } from '../rpc-client.js'

const thumb = (url: string) =>
  url.replace(/^(https?:\/\/media\.rvkfoodie\.is)\/?(.*)$/, '$1/cdn-cgi/image/width=320,fit=scale-down,format=webp/$2')

export function VenuePhotos({ venueId, photos }: { venueId: string; photos: readonly string[] }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const update = useResultMutation(client.venues.update)

  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'content-type': file.type,
          'x-venue-id': venueId,
          'x-filename': file.name,
        },
        body: file,
      })
      if (!res.ok) {
        setError(res.status === 401 ? 'Signed out — log in again.' : `Upload failed (${res.status})`)
        return
      }
      const { url } = (await res.json()) as { url: string }
      const result = await update.mutateAsync({ id: venueId, photos: [...photos, url] })
      if (result.status !== 'ok') setError(`Failed to save photo: ${result.error._tag}`)
    } catch {
      setError('Upload failed.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <Surface render={<section />} className="mb-6 p-4">
      <Text variant="heading3" as="h2" DANGEROUS_className="mb-2">
        Photos
      </Text>
      <div className="flex flex-wrap gap-2">
        {photos.map((url) => (
          <div key={url} className="flex flex-col items-center gap-1">
            <img src={thumb(url)} alt="" loading="lazy" className="h-20 w-20 rounded-md object-cover" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={update.state === 'pending'}
              onClick={() =>
                void update.mutateAsync({ id: venueId, photos: photos.filter((p) => p !== url) })
              }
            >
              remove
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/avif"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void upload(f)
          }}
        />
        {busy && (
          <>
            <Loader size="sm" />
            <Text variant="secondary" size="sm" as="span">
              Uploading…
            </Text>
          </>
        )}
        {error && (
          <Text variant="error" as="span">
            {error}
          </Text>
        )}
      </div>
    </Surface>
  )
}
