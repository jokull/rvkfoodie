/**
 * Root route: the document shell plus the ONE client runtime.
 *
 * `ResultRpcProvider` lives here, above every route, so a hydration
 * boundary in any route's component merges into the same runtime.
 */
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
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
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
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
  // The chrome lives in each surface's own layout: /app (operator shell),
  // /g (hotel guide shell), /_public (consumer site).
  return (
    <ResultRpcProvider client={client}>
      <Outlet />
    </ResultRpcProvider>
  )
}
