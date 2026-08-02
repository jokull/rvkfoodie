/**
 * /api/claim — Gumroad license-key verification (the "already purchased?"
 * form in the paywall). On success the product id lands in the browser's
 * unlocked set and we redirect back to the guide page.
 */
import { createFileRoute } from '@tanstack/react-router'
import { getSessionData, SESSION_COOKIE, readCookie, sessionCookie, setSessionData } from '../session.js'

export const Route = createFileRoute('/api/claim')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url)
        const formData = await request.formData()
        const licenseKey = formData.get('license_key')?.toString().trim()
        const productId = formData.get('product_id')?.toString()
        const slug = formData.get('slug')?.toString()

        if (!licenseKey || !productId || !slug) {
          return new Response(null, {
            status: 302,
            headers: { Location: `/guides/${slug ?? ''}?error=invalid_key` },
          })
        }

        try {
          const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              product_id: productId,
              license_key: licenseKey,
              increment_uses_count: 'false',
            }),
          })
          const data: {
            success?: boolean
            purchase?: { refunded?: boolean; chargebacked?: boolean }
          } = await response.json()

          if (data.success && !data.purchase?.refunded && !data.purchase?.chargebacked) {
            const existingId = readCookie(request, SESSION_COOKIE)
            const unlocked: string[] = existingId
              ? ((await getSessionData<string[]>(existingId, 'unlockedProducts')) ?? [])
              : []
            if (!unlocked.includes(productId)) {
              unlocked.push(productId)
              const sessionId = await setSessionData(existingId, 'unlockedProducts', unlocked)
              const headers = new Headers({ Location: `/guides/${slug}` })
              if (!existingId) headers.set('Set-Cookie', sessionCookie(sessionId))
              return new Response(null, { status: 302, headers })
            }
            return new Response(null, { status: 302, headers: { Location: `/guides/${slug}` } })
          }
        } catch {
          // Gumroad API error — fall through to the invalid-key redirect
        }

        return new Response(null, {
          status: 302,
          headers: { Location: `/guides/${slug}?error=invalid_key` },
        })
      },
    },
  },
})
