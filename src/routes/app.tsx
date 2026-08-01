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
    className="app-nav-link"
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
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="app-brand">
          <strong>rvkfoodie</strong>
          <span className="muted small">operator</span>
        </div>
        <nav className="app-nav">
          <NavLink to="/app" exact>
            Dashboard
          </NavLink>
          <NavLink to="/app/venues">Venues</NavLink>
          <NavLink to="/app/crm">CRM</NavLink>
          <NavLink to="/app/guides">Guide builder</NavLink>
          <span className="app-nav-item app-nav-disabled">
            Monthly pass <small>soon</small>
          </span>
        </nav>
        <p className="app-user muted small">{session.user.email}</p>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
