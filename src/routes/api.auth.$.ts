/**
 * better-auth's endpoint surface, mounted at /api/auth/* — the handler owns
 * its own responses and Set-Cookie. Server-only by construction.
 */
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../auth.js'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
      PUT: ({ request }) => auth.handler(request),
      DELETE: ({ request }) => auth.handler(request),
    },
  },
})
