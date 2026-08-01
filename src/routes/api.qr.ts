/**
 * QR endpoint: /api/qr?slug=<slug> → SVG of https://rvkfoodie.is/g/<slug>?src=qr
 * The ?src=qr tag lets analytics (ticket 09) count scans without a redirect
 * hop. Slug-only input (no arbitrary URLs) keeps this from becoming an
 * open QR proxy.
 */
import { createFileRoute } from '@tanstack/react-router'
import QRCode from 'qrcode'

export const Route = createFileRoute('/api/qr')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const slug = url.searchParams.get('slug')
        if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
          return new Response('bad slug', { status: 400 })
        }
        const svg = await QRCode.toString(`https://rvkfoodie.is/g/${slug}?src=qr`, {
          type: 'svg',
          margin: 1,
        })
        return new Response(svg, {
          headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' },
        })
      },
    },
  },
})
