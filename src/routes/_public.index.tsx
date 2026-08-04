/**
 * The consumer home — headline, guide catalog, bundle callout, author
 * blurb, latest editorials. All content comes from agent-cms singletons.
 */
import { createFileRoute } from '@tanstack/react-router'
import { GuideCard } from '../components/public.js'
import { prefetchPublicHome } from '../ssr.js'

export const Route = createFileRoute('/_public/')({
  loader: () => prefetchPublicHome(),
  component: Home,
})

function Home() {
  const { home, guides, editorials } = Route.useLoaderData()
  const latestPosts = editorials.slice(0, 3)

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
          {latestPosts.map((post) => (
            <a key={post.id} href={`/blog/${post.slug}`} className="block py-4 border-b border-ink/10 group">
              <h3 className="font-display text-xl leading-tight group-hover:text-blue transition-colors">
                {post.title}
              </h3>
              {post.excerpt && <p className="text-tiny text-ink-light mt-1">{post.excerpt}</p>}
            </a>
          ))}
        </section>
      )}

      {home.authorBlurb && (
        <section className="text-tiny text-ink-light prose-intro whitespace-pre-line">
          {home.authorBlurb}
        </section>
      )}
    </>
  )
}
