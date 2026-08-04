/**
 * The consumer guide page — /guides/<slug>. Ported from the legacy site:
 * sections with free venue cards visible, gated ones behind the Gumroad
 * paywall; unlocked renders everything + the Google Maps pin list. JSON-LD
 * Product + Breadcrumb in the head. Unlock flows are form POST → /api/claim
 * → 302 → this page re-renders with the session unlocked.
 */
import { createFileRoute } from '@tanstack/react-router'
import type { Editorial, Guide } from '../cms.js'
import { Paywall, VenueCard } from '../components/public.js'
import { dastToHtml } from '../dast.js'
import { prefetchPublicGuide } from '../ssr.js'

type GuidePagePayload = {
  guide: Guide | null
  allGuides: Guide[]
  editorials: Editorial[]
  unlockedProducts: string[]
  error?: string
  pending?: string
  key?: string
}

export const Route = createFileRoute('/_public/guides/$slug')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
    pending: typeof search.pending === 'string' ? search.pending : undefined,
    key: typeof search.key === 'string' ? search.key : undefined,
  }),
  head: ({ loaderData }) => {
    // loaderData is present at runtime; the type is `never` when a route has
    // both head and loader in this router version, so cast.
    const data = loaderData as GuidePagePayload | undefined
    const title = data?.guide ? `${data.guide.title} — Reykjavík Foodie` : 'Reykjavík Foodie'
    const description = data?.guide?.description
    return {
      meta: [
        { title },
        ...(description ? [{ name: 'description', content: description }] : []),
        ...(data?.guide?.slug
          ? [{ rel: 'canonical', href: `https://www.rvkfoodie.is/guides/${data.guide.slug}` }]
          : []),
        ...(data?.guide ? [{ property: 'og:title', content: data.guide.title }] : []),
        ...(description ? [{ property: 'og:description', content: description }] : []),
      ],
    }
  },
  loader: (ctx): Promise<GuidePagePayload> =>
    prefetchPublicGuide({
      data: {
        slug: (ctx.params as { slug: string }).slug,
        ...(ctx.location.search as { error?: string; pending?: string; key?: string }),
      },
    }),
  component: GuidePage,
})

function GuidePage() {
  // Cast: when a route has both head and loader, this router version types
  // useLoaderData() as undefined; the runtime value is the loader payload.
  const { guide, allGuides, editorials, unlockedProducts, error, pending, key } =
    Route.useLoaderData() as GuidePagePayload
  if (!guide) {
    return <p className="text-ink-light">This guide is not available.</p>
  }

  const otherGuides = allGuides.filter((g) => g.slug !== guide.slug)
  const unlocked = unlockedProducts.includes(guide.gumroadProductId)

  let totalHidden = 0
  let totalVenues = 0
  for (const block of guide.content) {
    if (block.blockType === 'section') {
      totalVenues += block.venues.length
      totalHidden += block.venues.filter((v) => !v.isFree).length
    }
  }

  const introHtml = guide.intro ? dastToHtml(guide.intro) : ''

  // Related posts: editorials that mention venues from this guide.
  const venueNames = guide.content.flatMap((b) =>
    b.blockType === 'section' ? b.venues.map((v) => v.name.toLowerCase().replace(/[!?]/g, '')) : [],
  )
  const relatedPosts = editorials
    .filter((p) => {
      const text = `${p.title} ${p.excerpt ?? ''}`.toLowerCase()
      return venueNames.some((vn) => text.includes(vn))
    })
    .slice(0, 3)

  return (
    <>
      <a href="/" className="text-tiny text-ink-light hover:text-blue transition-colors mb-8 inline-block">
        ← All guides
      </a>

      <h1 className="font-display text-huge leading-huge mb-2">{guide.title}</h1>
      {guide.subtitle && <p className="text-tiny text-ink-light mb-8">{guide.subtitle}</p>}

      {introHtml && <div className="mb-12 prose-intro" dangerouslySetInnerHTML={{ __html: introHtml }} />}

      {guide.content.map((block) => {
        if (block.blockType === 'section') {
          const freeVenues = block.venues.filter((v) => v.isFree)
          const gatedVenues = block.venues.filter((v) => !v.isFree)
          return (
            <section key={block.id} className="mb-12">
              <h2 className="font-display text-[1.75rem] leading-tight mb-2 pb-4 border-b border-ink/10">
                {block.title}
              </h2>
              {freeVenues.map((venue) => (
                <VenueCard key={venue.id} {...venue} />
              ))}
              {unlocked
                ? gatedVenues.map((venue) => <VenueCard key={venue.id} {...venue} />)
                : gatedVenues.length > 0 && (
                    <p className="py-6 text-blue text-tiny font-medium">+{gatedVenues.length} more in the full guide</p>
                  )}
            </section>
          )
        }
        if (block.blockType === 'textBlock') {
          if (!unlocked && !block.isFree) return null
          const html = dastToHtml(block.content)
          return (
            <section key={block.id} className="mb-12 prose-custom">
              {block.heading && (
                <h2 className="font-display text-[1.75rem] leading-tight mb-4 pb-4 border-b border-ink/10">
                  {block.heading}
                </h2>
              )}
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </section>
          )
        }
        return null
      })}

      {!unlocked && totalHidden > 0 && (
        <Paywall
          gumroadUrl={guide.gumroadUrl}
          price={guide.price}
          hiddenCount={totalHidden}
          slug={guide.slug}
          productId={guide.gumroadProductId}
          prefillKey={key}
          error={error === 'invalid_key' ? 'invalid' : undefined}
          pending={pending === 'true'}
        />
      )}

      {unlocked && guide.googleMapsUrl && (
        <div className="mb-12">
          <h2 className="font-display text-[1.75rem] leading-tight mb-4 pb-4 border-b border-ink/10">
            Google Maps
          </h2>
          <a
            href={guide.googleMapsUrl}
            target="_blank"
            rel="noopener"
            className="inline-block bg-blue text-white font-medium px-6 py-2.5 rounded-full text-tiny hover:opacity-90 transition-opacity"
          >
            Open pin list in Google Maps ↗
          </a>
        </div>
      )}

      {otherGuides.length > 0 && (
        <aside className="mt-16 border-t border-ink/10 pt-8">
          <h2 className="font-display text-xl leading-tight mb-4">More guides</h2>
          <ul className="space-y-3">
            {otherGuides.map((g) => (
              <li key={g.id}>
                <a href={`/guides/${g.slug}`} className="text-blue hover:opacity-80 transition-opacity">
                  {g.title} →
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {relatedPosts.length > 0 && (
        <aside className="mt-16 border-t border-ink/10 pt-8">
          <h2 className="font-display text-xl leading-tight mb-4">From the blog</h2>
          <ul className="space-y-3">
            {relatedPosts.map((p) => (
              <li key={p.id}>
                <a href={`/blog/${p.slug}`} className="text-blue hover:opacity-80 transition-opacity">
                  {p.title} →
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </>
  )
}
