/**
 * /blog/$slug — the editorial post: hero image, DAST content with inline
 * image blocks, venues mentioned in the post, and other posts.
 */
import { createFileRoute } from '@tanstack/react-router'
import type { Guide } from '../cms.js'
import { dastToHtml } from '../dast.js'
import { prefetchPublicBlogPost } from '../ssr.js'

export const Route = createFileRoute('/_public/blog/$slug')({
  loader: ({ params }) => prefetchPublicBlogPost({ data: { slug: params.slug } }),
  component: BlogPost,
})

type ContentNode = { type: string; item?: string; level?: number; style?: string; marks?: string[]; children?: ContentNode[] }

function renderNodes(nodes: ContentNode[], blocksById: Map<string, { image?: { url?: string | null }; caption?: string | null }>): React.ReactNode[] {
  return nodes.map((node, i) => {
    if (node.type === 'block') {
      const block = node.item ? blocksById.get(node.item) : undefined
      if (block?.image?.url) {
        return (
          <figure key={i} className="my-8">
            <img src={block.image.url} alt="" className="rounded-xl w-full" loading="lazy" />
            {block.caption && <figcaption className="text-tiny text-ink-light mt-2">{block.caption}</figcaption>}
          </figure>
        )
      }
      return null
    }
    if (node.type === 'paragraph') {
      return <p key={i} className="mb-4">{renderInlineNodes(node.children ?? [])}</p>
    }
    if (node.type === 'heading') {
      const Tag = `h${node.level ?? 2}` as 'h2' | 'h3'
      return <Tag key={i} className="font-display text-2xl leading-tight mt-8 mb-3">{renderInlineNodes(node.children ?? [])}</Tag>
    }
    if (node.type === 'list') {
      const Tag = node.style === 'numbered' ? 'ol' : 'ul'
      return (
        <Tag key={i} className="list-disc pl-6 mb-4">
          {(node.children ?? []).map((li, j) => (
            <li key={j} className="mb-1">{renderInlineNodes((li.children ?? []))}</li>
          ))}
        </Tag>
      )
    }
    return null
  })
}

function renderInlineNodes(nodes: ContentNode[]): React.ReactNode {
  return nodes.map((node, i) => {
    if (node.type === 'span') {
      let text: React.ReactNode = node.item ?? node.children?.map((c) => c.item ?? '').join('') ?? ''
      for (const mark of node.marks ?? []) {
        if (mark === 'strong') text = <strong key={i}>{text}</strong>
        else if (mark === 'emphasis') text = <em key={i}>{text}</em>
      }
      return <span key={i}>{text}</span>
    }
    return null
  })
}

function BlogPost() {
  const { post, allGuides } = Route.useLoaderData()
  if (!post) {
    return <p className="text-ink-light">This post is not available.</p>
  }

  const dateStr = post.date
    ? new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  // Venues mentioned in this post (matched by name against guide content).
  const postText = `${post.title} ${post.excerpt ?? ''}`.toLowerCase()
  const mentioned: { name: string; address: string; guideSlug: string; guideTitle: string }[] = []
  for (const guide of allGuides) {
    for (const block of guide.content) {
      if (block.blockType !== 'section') continue
      for (const v of block.venues) {
        const vName = v.name.toLowerCase().replace(/[!?]/g, '')
        if (postText.includes(vName) || vName.split(' ').every((w) => w.length > 3 && postText.includes(w))) {
          mentioned.push({ name: v.name, address: v.address, guideSlug: guide.slug, guideTitle: guide.title })
        }
      }
    }
  }

  const contentValue = (post.content as { value?: { document?: { children?: ContentNode[] } } } | undefined)?.value
  const blocksById = new Map(
    ((post.content as { blocks?: { id: string; image?: { url?: string | null }; caption?: string | null }[] } | undefined)?.blocks ?? []).map(
      (b) => [b.id, b],
    ),
  )
  const nodes = contentValue?.document?.children ?? []

  return (
    <>
      <a href="/blog" className="text-tiny text-ink-light hover:text-blue transition-colors mb-8 inline-block">
        ← The blog
      </a>
      <article>
        <p className="text-tiny leading-tiny text-ink-light mb-4">{dateStr}</p>
        <h1 className="font-display text-huge leading-huge mb-6">{post.title}</h1>
        {post.image?.url && (
          <img src={post.image.url} alt={post.image.alt ?? ''} className="rounded-xl w-full mb-8" />
        )}
        {post.excerpt && <p className="text-ink-light mb-8">{post.excerpt}</p>}
        <div className="prose-custom">{renderNodes(nodes, blocksById)}</div>
      </article>

      {mentioned.length > 0 && (
        <aside className="mt-16 border-t border-ink/10 pt-8">
          <h2 className="font-display text-xl leading-tight mb-4">Mentioned in this post</h2>
          <ul className="space-y-2">
            {mentioned.map((v) => (
              <li key={v.name}>
                <a href={`/guides/${v.guideSlug}`} className="text-blue hover:opacity-80 transition-opacity">
                  {v.name} ({v.guideTitle}) →
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </>
  )
}
