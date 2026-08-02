/**
 * /api/unlock — the Gumroad-ping → redirect landing: looks up the purchase
 * by token in KV, merges its product ids into the session, deletes the
 * token, and lands on the guide page (now unlocked).
 */
import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { getSessionData, SESSION_COOKIE, readCookie, sessionCookie, setSessionData } from '../session.js'

export const Route = createFileRoute('/api/unlock')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const token = url.searchParams.get('token')
        const fallbackSlug = url.searchParams.get('slug') ?? 'food-guide'

        if (!token) {
          return new Response(null, { status: 302, headers: { Location: `/guides/${fallbackSlug}` } })
        }

        const raw = await env.PURCHASES.get(`unlock:${token}`)
        if (!raw) {
          return new Response(null, { status: 302, headers: { Location: `/guides/${fallbackSlug}?pending=true` } })
        }

        const purchase = JSON.parse(raw) as { productIds: string[]; slug: string }

        const existingId = readCookie(request, SESSION_COOKIE)
        const unlocked: string[] = existingId
          ? ((await getSessionData<string[]>(existingId, 'unlockedProducts')) ?? [])
          : []
        for (const pid of purchase.productIds) {
          if (!unlocked.includes(pid)) unlocked.push(pid)
        }
        const sessionId = await setSessionData(existingId, 'unlockedProducts', unlocked)
        await env.PURCHASES.delete(`unlock:${token}`)

        const headers = new Headers({ Location: `/guides/${purchase.slug}` })
        if (!existingId) headers.set('Set-Cookie', sessionCookie(sessionId))
        return new Response(null, { status: 302, headers })
      },
    },
  },
})
