/**
 * The internal SPA shell — session-gated layout with the operator nav.
 * Signed-out renders the login form in place of the outlet.
 *
 * Shell pattern (collapsible sidebar, grouped nav, header with page title,
 * mobile sheet) adapted from shadcnspace's free dashboard shell, but built
 * on kumo's Sidebar component + Base UI primitives — no new UI deps.
 */
import { forwardRef } from 'react'
import { Link, Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { Sidebar, useSidebar } from '@cloudflare/kumo/components/sidebar'
import { LinkProvider, type LinkComponentProps } from '@cloudflare/kumo/utils'
import { Button } from '@cloudflare/kumo/components/button'
import {
  AddressBook,
  BookOpenText,
  Buildings,
  ForkKnife,
  Gauge,
  SignOut,
  Ticket,
} from '@phosphor-icons/react'
import { LoginForm } from '../components/login-form.js'
import { authClient } from '../auth-client.js'
import { getSession } from '../ssr.js'

export const Route = createFileRoute('/app')({
  loader: () => getSession(),
  component: AppShell,
})

/**
 * Bridge kumo's href-based links (sidebar nav, etc.) to TanStack Router
 * navigation so nav clicks stay client-side instead of full-page loads.
 * Documented kumo LinkProvider pattern.
 */
const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(({ href, ...rest }, ref) => (
  <Link ref={ref} to={href ?? ''} {...rest} />
))
AppLink.displayName = 'AppLink'

const TITLES: [prefix: string, title: string][] = [
  ['/app/venues', 'Venues'],
  ['/app/crm', 'CRM'],
  ['/app/guides', 'Guide builder'],
  ['/app/pass', 'Monthly pass'],
]

function AppShell() {
  const session = Route.useLoaderData()
  const { pathname } = useLocation()
  if (!session) return <LoginForm />

  const pageTitle =
    pathname === '/app' ? 'Dashboard' : (TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? 'App')

  return (
    <LinkProvider component={AppLink}>
      <Sidebar.Provider collapsible="icon" defaultOpen>
        <Shell pathname={pathname} pageTitle={pageTitle} email={session.user.email} />
      </Sidebar.Provider>
    </LinkProvider>
  )
}

/**
 * Lives inside Sidebar.Provider so `useSidebar` collapse state is available.
 * kumo collapses its own MenuButton labels; custom header/footer text hides
 * itself when collapsed (reappears while peeking).
 */
function Shell({ pathname, pageTitle, email }: { pathname: string; pageTitle: string; email: string }) {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'

  const isActive = (to: string, exact = false) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)

  const signOut = async () => {
    await authClient.signOut()
    window.location.href = '/'
  }

  return (
    <>
      <Sidebar className="md:sticky md:top-0 md:h-svh">
        <Sidebar.Header>
          <ForkKnife className="size-5 shrink-0" />
          <span className={`flex min-w-0 flex-col ${collapsed ? 'hidden' : ''}`}>
            <strong className="text-sm font-semibold">rvkfoodie</strong>
            <span className="text-sm text-slate-500">operator</span>
          </span>
        </Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Content</Sidebar.GroupLabel>
              <Sidebar.Menu>
                <Sidebar.MenuButton icon={Gauge} href="/app" active={isActive('/app', true)} tooltip="Dashboard">
                  Dashboard
                </Sidebar.MenuButton>
                <Sidebar.MenuButton icon={Buildings} href="/app/venues" active={isActive('/app/venues')} tooltip="Venues">
                  Venues
                </Sidebar.MenuButton>
                <Sidebar.MenuButton icon={BookOpenText} href="/app/guides" active={isActive('/app/guides')} tooltip="Guide builder">
                  Guide builder
                </Sidebar.MenuButton>
              </Sidebar.Menu>
            </Sidebar.Group>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Sales</Sidebar.GroupLabel>
              <Sidebar.Menu>
                <Sidebar.MenuButton icon={AddressBook} href="/app/crm" active={isActive('/app/crm')} tooltip="CRM">
                  CRM
                </Sidebar.MenuButton>
                <Sidebar.MenuButton icon={Ticket} href="/app/pass" active={isActive('/app/pass')} tooltip="Monthly pass">
                  Monthly pass
                </Sidebar.MenuButton>
              </Sidebar.Menu>
            </Sidebar.Group>
          </Sidebar.Content>
          <Sidebar.Footer>
            <span className={`flex min-w-0 flex-col ${collapsed ? 'hidden' : ''}`}>
              <span className="truncate text-sm font-medium">{email}</span>
              <span className="text-xs text-slate-500">signed in</span>
            </span>
            <span title="Sign out">
              <Button variant="secondary" size="sm" onClick={signOut}>
                <SignOut className="size-4" />
                {!collapsed && <span>Sign out</span>}
              </Button>
            </span>
          </Sidebar.Footer>
        </Sidebar>
        <div className="flex w-full min-w-0 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 px-4">
            <Sidebar.Trigger />
            <h1 className="text-base font-semibold">{pageTitle}</h1>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">
            <Outlet />
          </main>
        </div>
      </>
  )
}
