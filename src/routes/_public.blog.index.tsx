/**
 * /blog — the editorial index: post cards with hero images + excerpts.
 */
import { createFileRoute } from '@tanstack/react-router'
import { prefetchPublicBlogList } from '../ssr.js'

export const Route = createFileRoute('/_public/blog/')({
  head: () => ({
    meta: [
      { title: 'Blog — Reykjavík Foodie' },
      { name: 'description', content: 'Guides, round-ups and stories about eating well in Reykjavík.' },
      { property: 'og:type', content: 'website' },
    ],
  }),
  loader: () => prefetchPublicBlogList(),
  component: BlogIndex,
})

function BlogIndex() {
  const posts = Route.useLoaderData() as { id: string; title: string; slug: string; excerpt?: string | null; date?: string | null }[]
  return (
    <>
      <h1 className="font-display text-huge leading-huge mb-2">The blog</h1>
      <p className="text-tiny text-ink-light mb-8">Notes from eating around Reykjavík.</p>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <a href={`/blog/${post.slug}`} className="block py-6 border-b border-ink/10 group">
              <h2 className="font-display text-2xl leading-tight mb-1 group-hover:text-blue transition-colors">
                {post.title}
              </h2>
              {post.date && (
                <p className="text-tiny text-ink-light mb-1">
                  {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              {post.excerpt && <p className="text-normal leading-normal mb-1">{post.excerpt}</p>}
              <p className="text-tiny text-blue">Read →</p>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}
