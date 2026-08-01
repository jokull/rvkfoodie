/**
 * Email-OTP login (better-auth client). Single access tier — any verified
 * email signs in. The two founders' emails are the de facto allowlist.
 */
import { useState } from 'react'
import { createAuthClient } from 'better-auth/client'
import { emailOTPClient } from 'better-auth/client/plugins'

const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : undefined,
  plugins: [emailOTPClient()],
})

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    try {
      await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: 'sign-in' })
      setOtpSent(true)
    } catch (err) {
      setError("Couldn't send the code — try again.")
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp.trim()) return
    setBusy(true)
    setError(null)
    try {
      await authClient.signIn.emailOtp({ email, otp: otp.trim() })
      window.location.reload()
    } catch {
      setError("That code didn't work — check it and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <h1>Reykjavík Foodie</h1>
      <p className="muted">Operator sign-in — we'll email you a code.</p>
      {!otpSent ? (
        <form className="login-form" onSubmit={sendCode}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
        </form>
      ) : (
        <form className="login-form" onSubmit={verify}>
          <p className="muted">Code sent to {email}</p>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
            inputMode="numeric"
            autoFocus
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
