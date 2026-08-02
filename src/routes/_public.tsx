/**
 * Public consumer-site layout — the legacy chrome (cream background,
 * Instrument Serif display face, guide-links nav). Distinct from the /app
 * operator shell and the /g hotel-guide shell.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_public')({
  head: () => ({
    meta: [
      { title: 'Reykjavík Foodie — Local Food & Restaurant Guides' },
      {
        name: 'description',
        content: 'Honest food guides for Reykjavík — written by a local, updated regularly.',
      },
      { property: 'og:site_name', content: 'Reykjavík Foodie' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:type', content: 'website' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&display=swap',
      },
    ],
  }),
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <div className="public-shell">
      <header className="max-w-2xl mx-auto px-6 pt-8 sm:pt-12 pb-6 sm:pb-8">
        <nav className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
          <a href="/" className="font-display text-3xl sm:text-4xl tracking-tight">
            Reykjavík Foodie
          </a>
          <div className="flex items-center gap-4 sm:gap-6 text-tiny">
            <a href="/about" className="text-ink-light hover:text-blue transition-colors">
              About
            </a>
            <a href="/changelog" className="text-ink-light hover:text-blue transition-colors">
              Updates
            </a>
            <a
              href="https://instagram.com/rvkfoodie"
              target="_blank"
              rel="noopener"
              className="text-ink-light hover:text-blue transition-colors"
            >
              Instagram
            </a>
          </div>
        </nav>
      </header>
      <main className="max-w-2xl mx-auto px-6 pb-24">
        <Outlet />
      </main>
      <footer className="max-w-2xl mx-auto px-6 pb-12 text-tiny text-ink-light leading-tiny">
        <div className="border-t border-ink/10 pt-8 space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="/guides/food-guide" className="hover:text-blue transition-colors">
              Food Guide
            </a>
            <a href="/guides/bar-crawl" className="hover:text-blue transition-colors">
              Bar Crawl
            </a>
            <a href="/guides/golden-circle" className="hover:text-blue transition-colors">
              Golden Circle
            </a>
            <a href="/about" className="hover:text-blue transition-colors">
              About
            </a>
            <a href="/changelog" className="hover:text-blue transition-colors">
              Changelog
            </a>
          </div>
          <p>© {new Date().getFullYear()} Reykjavík Foodie — honest food guides for Reykjavík and Iceland.</p>
        </div>
      </footer>
    </div>
  )
}
