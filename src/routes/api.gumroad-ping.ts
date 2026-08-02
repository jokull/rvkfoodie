/**
 * /api/gumroad-ping — Gumroad's purchase webhook. Stores the purchase by
 * unlock token (+ sale_id fallback) in KV so /api/unlock can find it.
 */
import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

export const Route = createFileRoute('/api/gumroad-ping')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const kv = env.PURCHASES
        const formData = await request.formData()
        const productId = formData.get('product_id')?.toString()
        const refunded = formData.get('refunded')?.toString()
        const saleId = formData.get('sale_id')?.toString()
        const email = formData.get('email')?.toString()
        const urlParamsRaw = formData.get('url_params')?.toString()

        if (refunded === 'true') return new Response('OK', { status: 200 })

        const PRODUCT_SLUGS: Record<string, string> = {
          '2XvImS0EDlgIJTnyND9IPg==': 'food-guide',
          'Nh29BBzZgbR9j_zbd7G6gQ==': 'bar-crawl',
          'tQ2p0Rc-AOTIB9MbCgUAug==': 'golden-circle',
          'vV5i0_395VCDyRZPNuw2gQ==': 'bundle',
        }
        const BUNDLE_PRODUCTS = [
          '2XvImS0EDlgIJTnyND9IPg==', // food-guide
          'Nh29BBzZgbR9j_zbd7G6gQ==', // bar-crawl
        ]

        if (!productId || !PRODUCT_SLUGS[productId]) return new Response('OK', { status: 200 })

        let unlockToken: string | undefined
        if (urlParamsRaw) {
          try {
            unlockToken = (JSON.parse(urlParamsRaw) as { unlock_token?: string }).unlock_token
          } catch {
            // malformed url_params — ignore
          }
        }

        const productIds = productId === 'vV5i0_395VCDyRZPNuw2gQ==' ? BUNDLE_PRODUCTS : [productId]
        const slug = PRODUCT_SLUGS[productId]
        const purchaseData = JSON.stringify({
          productIds,
          slug: slug === 'bundle' ? 'food-guide' : slug,
          email,
          saleId,
          createdAt: new Date().toISOString(),
        })

        if (unlockToken) {
          await kv.put(`unlock:${unlockToken}`, purchaseData, { expirationTtl: 60 * 60 * 24 * 7 })
        }
        if (saleId) {
          await kv.put(`sale:${saleId}`, purchaseData, { expirationTtl: 60 * 60 * 24 * 365 })
        }

        return new Response('OK', { status: 200 })
      },
    },
  },
})
