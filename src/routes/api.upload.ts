/**
 * Photo upload — in-request PUT to the r2 binding (the media bucket behind
 * media.rvkfoodie.is). Session-gated like the staff mutations.
 *
 * The decided long-term flow is presigned R2 PUTs (out of band); that needs
 * an R2 API token (dashboard) for SigV4 signing, so the transport is this
 * route for now. The key scheme + returned raw CDN URL are unchanged by the
 * swap — only the write path differs.
 *
 * Request: POST body = image bytes; `x-venue-id` + `x-filename` headers.
 * Response: { url, key } — url is the raw object URL on the CDN domain;
 * renderers append cdn-cgi/image options.
 */
import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { auth } from '../auth.js'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif'])
const MEDIA_ORIGIN = 'https://media.rvkfoodie.is'

export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('unauthorized', { status: 401 })

        const contentType = request.headers.get('content-type') ?? ''
        const venueId = request.headers.get('x-venue-id')
        const filename = request.headers.get('x-filename')
        if (!venueId || !filename) return new Response('missing headers', { status: 400 })
        if (!ALLOWED.has(contentType)) return new Response('unsupported content type', { status: 415 })
        const contentLength = Number(request.headers.get('content-length') ?? 0)
        if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_BYTES) {
          return new Response('invalid size', { status: 413 })
        }

        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-60)
        const key = `venues/${venueId}/${Date.now()}-${safeName}`
        await env.MEDIA.put(key, request.body, {
          httpMetadata: { contentType },
        })
        return Response.json({ url: `${MEDIA_ORIGIN}/${key}`, key })
      },
    },
  },
})
