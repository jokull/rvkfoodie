/**
 * The consumer home — headline, guide catalog, bundle callout, author
 * blurb, latest editorials. All content comes from agent-cms singletons.
 */
import { createFileRoute } from '@tanstack/react-router'
import { GuideCard, cdnImage, imageSrcSet } from '../components/public.js'
import type { Editorial } from '../cms.js'
import { prefetchPublicHome } from '../ssr.js'

/** Editorial-photo collage layout — reclaimed from the legacy home page. */
const collageCards = [
  { x: -280, y: 10, rot: '-6deg', z: 4, w: 150 },
  { x: -150, y: 100, rot: '4deg', z: 7, w: 135 },
  { x: -50, y: 0, rot: '7deg', z: 3, w: 165 },
  { x: 60, y: 85, rot: '-3deg', z: 8, w: 150 },
  { x: 140, y: -5, rot: '-5deg', z: 5, w: 155 },
  { x: 260, y: 90, rot: '6deg', z: 6, w: 135 },
  { x: -200, y: 190, rot: '3deg', z: 1, w: 120 },
  { x: 170, y: 185, rot: '-4deg', z: 2, w: 125 },
]

type CollagePhoto = Editorial & { image: NonNullable<Editorial['image']> & { url: string } }

export const Route = createFileRoute('/_public/')({
  head: () => ({
    meta: [{ property: 'og:image', content: 'https://www.rvkfoodie.is/og-default.png' }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Reykjavík Foodie',
          url: 'https://www.rvkfoodie.is',
          description: 'Honest food guides for Reykjavík — written by a local, updated regularly.',
        }),
      },
    ],
  }),
  loader: () => prefetchPublicHome(),
  component: Home,
})

function Home() {
  const { home, guides, editorials } = Route.useLoaderData()
  const latestPosts = editorials.slice(0, 3)
  const collagePhotos = editorials.filter(
    (p): p is CollagePhoto => !!p.image?.url,
  ).slice(0, 8)

  return (
    <>
      <div className="mb-12">
        <h1 className="font-display text-huge leading-huge mb-6">
          {home.headline}
          <br />
          {home.headlineEmphasis && <em>{home.headlineEmphasis}</em>}
        </h1>
        {home.subtext && <p className="text-ink-light max-w-xl">{home.subtext}</p>}
      </div>

      {collagePhotos.length > 0 && (
        <div className="relative h-56 sm:h-[22rem] mb-16 -mx-6 sm:mx-0 overflow-hidden sm:overflow-visible">
          <div className="absolute inset-0 origin-top scale-[0.55] sm:scale-100">
            {collagePhotos.map((photo, i) => {
              const card = collageCards[i]
              if (!card) return null
              const srcSet = imageSrcSet(photo.image.url, [card.w, card.w * 2, card.w * 3])
              return (
                <div
                  key={photo.id}
                  className="absolute rounded-2xl overflow-hidden shadow-lg border-4 border-cream"
                  style={{
                    left: `calc(50% + ${card.x}px)`,
                    top: card.y,
                    width: card.w,
                    height: card.w,
                    marginLeft: -card.w / 2,
                    transform: `rotate(${card.rot})`,
                    zIndex: card.z,
                  }}
                >
                  <img
                    src={srcSet ? cdnImage(photo.image.url, card.w) : photo.image.url}
                    srcSet={srcSet}
                    sizes={`${card.w}px`}
                    alt={photo.image.alt ?? photo.title ?? ''}
                    className="w-full h-full object-cover"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <section className="mb-14">
        <h2 className="font-display text-[1.75rem] leading-tight mb-2 pb-4 border-b border-ink/10">
          Guides
        </h2>
        {guides.map((guide) => (
          <GuideCard key={guide.id} guide={guide} />
        ))}
      </section>

      {home.bundleTitle && (
        <section className="mb-14 border border-ink/10 rounded-2xl p-8 text-center">
          <h2 className="font-display text-[1.75rem] leading-tight mb-2">{home.bundleTitle}</h2>
          {home.bundleDescription && <p className="text-ink-light mb-4">{home.bundleDescription}</p>}
          {home.bundleGumroadUrl && (
            <a
              href={home.bundleGumroadUrl}
              target="_blank"
              rel="noopener"
              className="inline-block bg-blue text-white font-medium px-8 py-3 rounded-full hover:opacity-90 transition-opacity"
            >
              {home.bundlePrice ? `Get the bundle — $${home.bundlePrice}` : 'Get the bundle'}
            </a>
          )}
        </section>
      )}

      {latestPosts.length > 0 && (
        <section className="mb-14">
          <h2 className="font-display text-[1.75rem] leading-tight mb-2 pb-4 border-b border-ink/10">
            Latest from the blog
          </h2>
          {latestPosts.map((post) => {
            const srcSet = post.image?.url ? imageSrcSet(post.image.url, [96, 128, 256, 384]) : undefined
            return (
              <a key={post.id} href={`/blog/${post.slug}`} className="flex gap-5 group items-start py-4 border-b border-ink/10">
                {post.image?.url && (
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden shrink-0">
                    <img
                      src={srcSet ? cdnImage(post.image.url, 128) : post.image.url}
                      srcSet={srcSet}
                      sizes="128px"
                      alt={post.image.alt ?? post.title ?? ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-xl leading-tight group-hover:text-blue transition-colors">
                    {post.title}
                  </h3>
                  {post.excerpt && <p className="text-tiny text-ink-light mt-1">{post.excerpt}</p>}
                </div>
              </a>
            )
          })}
        </section>
      )}

      {home.authorBlurb && (
        <section className="border-t border-ink/10 pt-8">
          <div className="flex items-center gap-4">
            <img src="/about.jpg" alt="Reykjavík Foodie" className="w-14 h-18 rounded-lg object-cover" loading="lazy" />
            <p className="text-ink-light">
              {home.authorBlurb}{' '}
              <a href="/about" className="text-blue hover:opacity-80 transition-opacity">
                Read more →
              </a>
            </p>
          </div>
        </section>
      )}
    </>
  )
}
