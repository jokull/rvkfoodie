/**
 * /places/$slug — the venue landing page (the venue cards link here).
 * Rendered read-only from agent-cms data: name, description, opening
 * hours, maps/website/phone, the guide-upsell panel, nearby free spots
 * from the same section, and related blog posts. JSON-LD Restaurant +
 * Breadcrumb via route head (loaderData runtime cast — same router quirk
 * as the guide page).
 */
import { createFileRoute } from '@tanstack/react-router'
import type { Editorial, Venue } from '../cms.js'
import { venueUrl } from '../venue-url.js'
import { prefetchPublicPlace } from '../ssr.js'

type PlaceVenue = Venue & { sectionTitle: string; guideSlug: string; guideTitle: string; guidePrice: number }

type PlacePayload = {
  venue: PlaceVenue | null
  guideVenueCount: number
  guideSectionNames: string[]
  nearby: Venue[]
  relatedPosts: Editorial[]
}

export const Route = createFileRoute('/_public/places/$slug')({
  head: ({ loaderData }) => {
    const data = loaderData as PlacePayload | undefined
    const v = data?.venue
    if (!v) return { meta: [{ title: 'Reykjavík Foodie' }] }
    return {
      meta: [
        { title: `${v.name} — Reykjavík Foodie` },
        ...(v.description ? [{ name: 'description', content: v.description.slice(0, 160) }] : []),
        { rel: 'canonical', href: `https://www.rvkfoodie.is${venueUrl(v)}` },
        { property: 'og:title', content: v.name },
        ...(v.image?.url ? [{ property: 'og:image', content: v.image.url }] : []),
      ],
    }
  },
  loader: ({ params }) => prefetchPublicPlace({ data: { slug: params.slug } }),
  component: PlacePage,
})

function PlacePage() {
  const { venue, guideVenueCount, guideSectionNames, nearby, relatedPosts } =
    Route.useLoaderData() as PlacePayload
  if (!venue) {
    return <p className="text-ink-light">This place is not in any guide.</p>
  }

  const v = venue
  const mapsUrl =
    v.googleMapsUrl ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name} ${v.address} Iceland`)}`
  const venueImgUrl = v.image?.url ?? null

  return (
    <>
      <a
        href={`/guides/${v.guideSlug}`}
        className="text-tiny text-ink-light hover:text-blue transition-colors mb-8 inline-block"
      >
        ← {v.guideTitle}
      </a>

      <article>
        {venueImgUrl && (
          <div className="mb-8 rounded-2xl overflow-hidden">
            <img src={venueImgUrl} alt={v.image?.alt ?? v.name} className="w-full rounded-2xl" loading="eager" />
          </div>
        )}
        <p className="text-tiny leading-tiny text-blue font-medium tracking-wide uppercase mb-3">{v.sectionTitle}</p>
        {v.bestOfAward && (
          <p className="text-tiny font-medium mb-3">
            {v.grapevineUrl ? (
              <a href={v.grapevineUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-blue hover:opacity-80 transition-opacity">
                🏆 {v.bestOfAward}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-blue">🏆 {v.bestOfAward}</span>
            )}
          </p>
        )}
        <h1 className="font-display text-huge leading-huge mb-2">{v.name}</h1>
        {v.address && (
          <a href={mapsUrl} target="_blank" rel="noopener" className="text-tiny text-ink-light hover:text-blue transition-colors inline-block mb-4">
            {v.address} ↗
          </a>
        )}
        {v.openingHours && <p className="text-tiny text-ink-light mb-4">{v.openingHours}</p>}
        {v.time && <p className="text-tiny text-ink-light mb-4">{v.time}</p>}
        {(v.phone ?? v.website) && (
          <div className="flex gap-4 text-tiny text-ink-light mb-6">
            {v.phone && <span>{v.phone}</span>}
            {v.website && (
              <a
                href={/^https?:/.test(v.website) ? v.website : `https://${v.website}`}
                target="_blank"
                rel="noopener"
                className="text-blue hover:opacity-80 transition-opacity"
              >
                {v.website}
              </a>
            )}
          </div>
        )}
        <p className="mb-6">{v.description}</p>
        {v.note && <p className="text-tiny text-ink-light/70 mb-8">{v.note}</p>}

        <div className="flex flex-wrap gap-3 mb-12">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener"
            className="inline-block border border-ink/15 rounded-full px-5 py-2 text-tiny hover:border-blue hover:text-blue transition-colors"
          >
            Open in Google Maps ↗
          </a>
        </div>
      </article>

      <div className="border border-ink/10 rounded-2xl p-8 mb-12">
        <p className="text-tiny text-blue font-medium uppercase tracking-wide mb-2">From the {v.guideTitle}</p>
        <h2 className="font-display text-[1.75rem] leading-tight mb-3">
          {v.name} is one of {guideVenueCount} hand-picked spots
        </h2>
        <p className="text-ink-light mb-2">
          The full guide covers {guideSectionNames.join(', ')} — every spot personally vetted by a local.
        </p>
        <p className="text-ink-light mb-6 text-tiny">Includes Google Maps pin list and regular updates when places open, close, or change.</p>
        <a
          href={`/guides/${v.guideSlug}`}
          className="inline-block bg-blue text-white font-medium px-6 py-2.5 rounded-full text-tiny hover:opacity-90 transition-opacity"
        >
          See the full guide — ${v.guidePrice}
        </a>
      </div>

      {relatedPosts.length > 0 && (
        <aside className="border-t border-ink/10 pt-8 mb-8">
          <h2 className="font-display text-[1.5rem] leading-tight mb-4">From the blog</h2>
          <div className="space-y-4">
            {relatedPosts.map((p) => (
              <a
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="block border border-ink/10 rounded-xl p-5 hover:border-ink/25 transition-colors group"
              >
                <p className="text-tiny text-ink-light mb-1">
                  {p.date ? new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                </p>
                <h3 className="font-display text-[1.25rem] leading-tight group-hover:text-blue transition-colors">{p.title}</h3>
              </a>
            ))}
          </div>
        </aside>
      )}

      {nearby.length > 0 && (
        <aside className="border-t border-ink/10 pt-8">
          <h2 className="font-display text-[1.5rem] leading-tight mb-2">Also in {v.sectionTitle}</h2>
          <p className="text-tiny text-ink-light mb-4">
            Free preview from the{' '}
            <a href={`/guides/${v.guideSlug}`} className="text-blue hover:opacity-80 transition-opacity">
              {v.guideTitle}
            </a>
          </p>
          <div className="space-y-4">
            {nearby.map((nv) => (
              <a
                key={nv.id}
                href={venueUrl(nv)}
                className="block border border-ink/10 rounded-xl p-5 hover:border-ink/25 transition-colors group"
              >
                <h3 className="font-display text-[1.25rem] leading-tight group-hover:text-blue transition-colors">{nv.name}</h3>
                {nv.address && <p className="text-tiny text-ink-light mt-1">{nv.address}</p>}
              </a>
            ))}
          </div>
        </aside>
      )}
    </>
  )
}
