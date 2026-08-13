/**
 * /search — noindex. Semantic search (guides + editorials via agent-cms's
 * Vectorize index) with a substring fallback, plus always-on venue substring
 * matching. The loader runs SSR-first so results ride the document request;
 * the form re-navigates with ?q= for each query.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { SearchResult } from '../cms.js'
import { prefetchPublicSearch } from '../ssr.js'

type SearchParams = { q?: string }

const EXAMPLES = ['dinner reservations', 'best bakery', 'cocktail bars', 'golden circle stops', 'tapas wine']

const TYPE_LABEL: Record<SearchResult['type'], string> = {
  guide: 'Guide',
  editorial: 'Blog',
  venue: 'Venue',
}

export const Route = createFileRoute('/_public/search')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Search — Reykjavík Foodie' },
      { name: 'robots', content: 'noindex, follow' },
    ],
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => {
    const q = deps.q?.trim() ?? ''
    if (q.length < 2) return []
    return prefetchPublicSearch({ data: { q } })
  },
  component: SearchPage,
})

function SearchPage() {
  const results = Route.useLoaderData() as SearchResult[]
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [q, setQ] = useState(search.q ?? '')

  const submit = (query: string) => {
    navigate({ to: '/search', search: { q: query.trim() } })
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Search</h1>
        <p className="text-ink-light mt-2">
          Every spot, guide and story across Reykjavík Foodie.
        </p>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit(q)
        }}
        role="search"
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try “best bakery” or “cocktail bars”…"
          className="flex-1 border border-ink/20 rounded-full px-5 py-3 outline-none focus:border-blue"
        />
        <button
          type="submit"
          className="bg-ink text-cream rounded-full px-6 py-3 hover:opacity-80 transition-opacity"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQ(ex)
              submit(ex)
            }}
            className="text-sm border border-ink/15 rounded-full px-3 py-1.5 text-ink-light hover:border-blue hover:text-blue transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {(search.q?.length ?? 0) >= 2 && (
        <section aria-label="Results" className="space-y-2">
          {results.length === 0 ? (
            <p className="text-ink-light">
              Nothing matched “{search.q}”. Try one of the suggestions above.
            </p>
          ) : (
            results.map((r) => (
              <a
                key={r.url}
                href={r.url}
                className="flex items-center gap-4 border border-ink/10 rounded-2xl p-4 hover:border-blue transition-colors"
              >
                {r.image ? (
                  <img
                    src={r.image}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover flex-none"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-cream border border-ink/10 flex items-center justify-center flex-none text-[11px] uppercase tracking-wide text-ink-light">
                    {TYPE_LABEL[r.type]}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {r.badge && (
                      <span className="text-[10px] uppercase tracking-wide text-blue mr-2">
                        {r.badge}
                      </span>
                    )}
                    {r.title}
                  </p>
                  <p className="text-sm text-ink-light truncate">{r.subtitle}</p>
                </div>
              </a>
            ))
          )}
        </section>
      )}
    </div>
  )
}
