/**
 * Photo manager on the venue detail. Uploads stream to /api/upload
 * (session cookie rides the same-origin request) and the returned URL is
 * added to the venue's photos via updateVenue — the same entity mutation
 * the edit form uses, so the cache patches everywhere.
 */
import { useRef, useState } from 'react'
import { useResultMutation } from 'result-rpc/react'
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
      if (!result.ok) setError(`Failed to save photo: ${result.error._tag}`)
    } catch {
      setError('Upload failed.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Photos</h2>
      <div className="photo-strip">
        {photos.map((url) => (
          <div key={url} className="photo-cell">
            <img src={thumb(url)} alt="" loading="lazy" />
            <button
              className="link-button"
              disabled={update.state === 'pending'}
              onClick={() =>
                void update.mutateAsync({ id: venueId, photos: photos.filter((p) => p !== url) })
              }
            >
              remove
            </button>
          </div>
        ))}
      </div>
      <div className="photo-upload">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/avif"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void upload(f)
          }}
        />
        {busy && <span className="muted small">Uploading…</span>}
        {error && <span className="error">{error}</span>}
      </div>
    </section>
  )
}
