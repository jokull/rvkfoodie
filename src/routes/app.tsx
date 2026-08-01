/**
 * The internal SPA shell — gated on session. Minimal for now: signed-out
 * shows the email-OTP login, signed-in shows the operator view. The real
 * screen inventory (CRM, venues, guide builder, monthly pass) is ticket 11.
 */
import { createFileRoute } from '@tanstack/react-router'
import { LoginForm } from '../components/login-form.js'
import { getSession } from '../ssr.js'

export const Route = createFileRoute('/app')({
  loader: () => getSession(),
  component: App,
})

function App() {
  const session = Route.useLoaderData()
  if (!session) return <LoginForm />
  return (
    <div className="app-shell">
      <h1>Reykjavík Foodie — operator</h1>
      <p className="muted">
        Signed in as <strong>{session.user.email}</strong>.
      </p>
      <p className="muted">
        The internal screens (CRM, venues, guide builder, monthly pass) land
        with ticket 11.
      </p>
    </div>
  )
}
