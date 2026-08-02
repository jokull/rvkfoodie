/**
 * /sitemap — XML sitemap for the consumer site: static pages + guides +
 * editorials from the CMS. Served with an XML content type.
 */
import { createFileRoute } from '@tanstack/react-router'
import { prefetchPublicSitemap } from '../ssr.js'

const ORIGIN = 'https://www.rvkfoodie.is'

export const Route = createFileRoute('/sitemap')({
  server: {
    handlers: {
      GET: async () => {
        const sitemap = await prefetchPublicSitemap()
        const urls = [
          `${ORIGIN}/`,
          `${ORIGIN}/blog`,
          `${ORIGIN}/changelog`,
          `${ORIGIN}/about`,
          ...sitemap.guides.map((slug) => `${ORIGIN}/guides/${slug}`),
          ...sitemap.editorials.map((slug) => `${ORIGIN}/blog/${slug}`),
        ]
        const unique = [...new Set(urls)]
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>`
        return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
      },
    },
  },
})
