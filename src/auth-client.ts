/**
 * Shared better-auth browser client. Used by the login form (OTP sign-in)
 * and the app shell (sign-out). Keep client-side only — server auth lives
 * in `auth.ts` and runs under `cloudflare:workers`.
 */
import { createAuthClient } from 'better-auth/client'
import { emailOTPClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : undefined,
  plugins: [emailOTPClient()],
})
