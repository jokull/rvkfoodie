/**
 * /api/checkout — stamps a session, stashes an unlock token in KV, and
 * redirects to Gumroad with `unlock_token` so the ping webhook can find it.
 */
import { createFileRoute } from '@tanstack/react-router'
import { SESSION_COOKIE, readCookie, sessionCookie, setSessionData } from '../session.js'

export const Route = createFileRoute('/api/checkout')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const slug = url.searchParams.get('slug')
        const gumroadUrl = url.searchParams.get('url')
        if (!slug || !gumroadUrl) return new Response(null, { status: 302, headers: { Location: '/' } })

        const existingId = readCookie(request, SESSION_COOKIE)
        const token = crypto.randomUUID()
        const sessionId = await setSessionData(existingId, 'unlockToken', token)

        const sep = gumroadUrl.includes('?') ? '&' : '?'
        const location = `${gumroadUrl}${sep}wanted=true&unlock_token=${token}`

        const headers = new Headers({ Location: location })
        if (!existingId) headers.set('Set-Cookie', sessionCookie(sessionId))
        return new Response(null, { status: 302, headers })
      },
    },
  },
})
