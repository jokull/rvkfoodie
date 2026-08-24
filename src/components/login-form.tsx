/**
 * Email-OTP login (better-auth client). Single access tier — any verified
 * email signs in. The two founders' emails are the de facto allowlist.
 */
import { useState } from 'react'
import { Button } from '@cloudflare/kumo/components/button'
import { Input } from '@cloudflare/kumo/components/input'
import { Text } from '@cloudflare/kumo/components/text'
import { authClient } from '../auth-client.js'

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
    <div className="mx-auto max-w-sm px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold">Reykjavík Foodie</h1>
      <Text variant="secondary">Operator sign-in — we'll email you a code.</Text>
      {!otpSent ? (
        <form className="mt-4 flex flex-col gap-2" onSubmit={sendCode}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Button type="submit" variant="primary" loading={busy}>
            Email me a code
          </Button>
        </form>
      ) : (
        <form className="mt-4 flex flex-col gap-2" onSubmit={verify}>
          <Text variant="secondary">Code sent to {email}</Text>
          <Input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
            inputMode="numeric"
            autoFocus
            required
          />
          <Button type="submit" variant="primary" loading={busy}>
            Sign in
          </Button>
          <div className="flex items-center justify-center gap-3 text-sm">
            <button
              type="button"
              className="text-kumo-link hover:underline"
              onClick={() => void authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: 'sign-in' })}
            >
              Resend code
            </button>
            <span className="text-slate-400">·</span>
            <button type="button" className="text-kumo-link hover:underline" onClick={() => { setOtpSent(false); setOtp(''); setEmail('') }}>
              Use a different email
            </button>
          </div>
        </form>
      )}
      {error && <Text variant="error">{error}</Text>}
    </div>
  )
}
