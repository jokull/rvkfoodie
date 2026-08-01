/**
 * Root route: the document shell plus the ONE client runtime.
 *
 * `ResultRpcProvider` lives here, above every route, so a hydration
 * boundary in any route's component merges into the same runtime.
 */
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { isTaggedError } from 'result-rpc'
import { ResultRpcProvider } from 'result-rpc/react'
import { client } from '../rpc-client.js'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Reykjavík Foodie — curated guides for hotels' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
  errorComponent: ({ error }) => (
    <p role="alert" className="error">
      Broken: {isTaggedError(error) ? error._tag : error.message}
    </p>
  ),
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  return (
    <ResultRpcProvider client={client}>
      <header className="site-header">
        <Link to="/" className="brand">
          🇮🇸 Reykjavík Foodie
        </Link>
        <span className="subtitle">curated guides for hotels</span>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        Fresh TanStack Start × result-rpc × D1 scaffold
      </footer>
    </ResultRpcProvider>
  )
}
