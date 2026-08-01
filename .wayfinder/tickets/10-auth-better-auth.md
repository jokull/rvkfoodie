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
