/**
 * DAST (DatoCMS Abstract Syntax Tree) → HTML renderer, ported from the
 * legacy site. The library handles standard nodes; a manual renderer
 * covers the same node set without it (fallback). Block nodes are skipped
 * — templates render them.
 */
import { render } from 'datocms-structured-text-to-html-string'

interface DastSpan {
  type: 'span'
  value?: string
  marks?: string[]
}

interface DastLink {
  type: 'link'
  url: string
  children?: DastInline[]
}

type DastInline = DastSpan | DastLink | { type: string; value?: string }

interface DastNode {
  type: string
  level?: number
  style?: string
  url?: string
  value?: string
  item?: string
  marks?: string[]
  children?: DastNode[]
}

interface DastDocument {
  schema?: string
  document?: { type: string; children?: DastNode[] }
}

/** Render DAST structured text to an HTML string (blocks handled by templates). */
export function dastToHtml(st: unknown): string {
  if (!st || typeof st !== 'object') return ''

  const doc = ('value' in st && st.value ? st.value : st) as DastDocument | undefined
  if (!doc?.schema && !doc?.document) return ''

  try {
    const result = render(
      { value: doc },
      { renderBlock: () => '' },
    )
    return result ?? ''
  } catch {
    return manualRender(doc)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderInline(node: DastNode): string {
  if (!node) return ''
  if (node.type === 'span') {
    let html = escapeHtml(node.value ?? '')
    for (const mark of node.marks ?? []) {
      if (mark === 'strong') html = `<strong>${html}</strong>`
      else if (mark === 'emphasis') html = `<em>${html}</em>`
      else if (mark === 'underline') html = `<u>${html}</u>`
      else if (mark === 'code') html = `<code>${html}</code>`
    }
    return html
  }
  if (node.type === 'link') {
    return `<a href="${escapeHtml(node.url ?? '')}">${(node.children ?? []).map(renderInline).join('')}</a>`
  }
  return node.value ? escapeHtml(node.value) : ''
}

function renderNode(node: DastNode): string {
  if (!node) return ''
  if (node.type === 'paragraph') return `<p>${(node.children ?? []).map(renderInline).join('')}</p>`
  if (node.type === 'heading') {
    const tag = `h${node.level ?? 2}`
    return `<${tag}>${(node.children ?? []).map(renderInline).join('')}</${tag}>`
  }
  if (node.type === 'list') {
    const tag = node.style === 'numbered' ? 'ol' : 'ul'
    return `<${tag}>${(node.children ?? []).map((li) => `<li>${(li.children ?? []).map(renderNode).join('')}</li>`).join('')}</${tag}>`
  }
  if (node.type === 'blockquote') return `<blockquote>${(node.children ?? []).map(renderNode).join('')}</blockquote>`
  if (node.type === 'block') return ''
  return ''
}

function manualRender(doc: DastDocument): string {
  const document = doc.document ?? doc
  const children = (document as { children?: DastNode[] }).children
  if (!children) return ''
  return children.map(renderNode).join('\n')
}
