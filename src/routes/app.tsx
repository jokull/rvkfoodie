/**
 * The internal SPA shell — session-gated layout with the operator nav.
 * Signed-out renders the login form in place of the outlet.
 */
import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { LoginForm } from '../components/login-form.js'
import { getSession } from '../ssr.js'

export const Route = createFileRoute('/app')({
  loader: () => getSession(),
  component: AppShell,
})

const NavLink = ({ to, exact, children }: { to: string; exact?: boolean; children: React.ReactNode }) => (
  <Link
    to={to}
    className="no-underline"
    activeProps={{ 'data-active': '' }}
    activeOptions={exact ? { exact: true } : undefined}
  >
    {children}
  </Link>
)

function AppShell() {
  const session = Route.useLoaderData()
  if (!session) return <LoginForm />
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50 px-4 py-5">
        <div className="mb-5 flex flex-col">
          <strong className="text-sm font-semibold">rvkfoodie</strong>
          <span className="text-sm text-slate-500">operator</span>
        </div>
        <nav className="flex flex-col gap-1">
          <NavLink to="/app" exact>
            Dashboard
          </NavLink>
          <NavLink to="/app/venues">Venues</NavLink>
          <NavLink to="/app/crm">CRM</NavLink>
          <NavLink to="/app/guides">Guide builder</NavLink>
          <NavLink to="/app/pass">Monthly pass</NavLink>
        </nav>
        <p className="mt-auto truncate text-sm text-slate-500">{session.user.email}</p>
      </aside>
      <main className="w-full max-w-5xl px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
