# Auth: better-auth on D1 + TanStack Start

`wayfinder:research` — blocking: none

## Question

Pin the better-auth integration for this stack, then implement it:

- better-auth with the Drizzle adapter over the same D1 database; email OTP
  (primary) + optional password; long-lived cookie sessions; single access
  tier, no roles (two founders).
- OTP delivery via the EMAIL binding (shares the sending path from ticket
  07).
- TanStack Start SSR: where auth state lives for loaders/server functions
  (session cookie → better-auth API → context for result-rpc procedures),
  and how the internal SPA routes gate on it (redirect to OTP screen).
- Users table shape (email, emailVerified, password hash nullable,
  createdAt/updatedAt) and where it lives relative to the app schema
  (better-auth's own table set in the same D1).

Research first (better-auth Cloudflare/Start integration docs, Drizzle
adapter, session storage), then implement. Blocks the internal SPA
(ticket 11).

## Resolution (claimed 2026-08-01)

- **Verdict on the drizzle-1.0 question: better-auth's Drizzle adapter is
  empirically compatible with drizzle-orm 1.0.0-rc.4 on D1.** Adapter code
  was updated for v1.0 query syntax (#6766 closed); only the peer range is
  stale (#10501 open — cosmetic pnpm warning). Verified against the real
  local D1: INSERT (send-verification-otp) + SELECT (sign-in wrong-code →
  INVALID_OTP), zero internal errors. Iron-session fallback NOT needed.
- auth tables (user/session/account/verification) from the official CF
  fixture, in drizzle.config schema; email OTP primary + optional
  email/password; OTP delivered via the EMAIL binding (Message-ID/Date
  headers required by send_email); 30-day sliding session; CSRF Origin
  guard working.
- Mounted at /api/auth/$; getSession server fn for loaders; minimal /app
  route gates on session with the login form.
- Config: BETTER_AUTH_URL + BETTER_AUTH_SECRET vars (secret via wrangler
  secret / .dev.vars).
