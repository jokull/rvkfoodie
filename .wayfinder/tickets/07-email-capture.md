# Email: binding ops + capture flow

`wayfinder:task` — blocking: 06-guide-page

## Question

Stand up the email side (execution + ops; send_email is beta):

**Ops (may start immediately, unblocked):**
- Apply for / confirm the send_email beta grant.
- Verify a from-address on rvkfoodie.is (the `EMAIL` binding
  `destination_address` in wrangler.jsonc is a placeholder).
- Create the Turnstile site (widget on the email-capture form) + secret;
  wire site key into the page and verify tokens server-side
  (siteverify API) before sending.

**Product:**
- Email-capture procedure (result-rpc mutation): validates the Turnstile
  token, stores/updates a capture record, sends the guide as an HTML email
  via `cloudflare:email` (`EmailMessage`). Rate limit (per-IP counter in
  D1) as belt-and-suspenders on top of Turnstile.
- The HTML email IS the guide snapshot (mobile-friendly, inline styles) —
  the offline-"keeping" artifact. HTML template decision (hand-rolled
  table-based vs. a renderer) is a small research question.
- OTP emails for better-auth (ticket 10) share this sending path.

## Status (2026-08-01)

- Product part done: guide_captures table, captures.request, table-based HTML
  guide email via the EMAIL binding (Message-ID/Date headers), guide page
  capture form.
- Ops: send_email beta granted (email enabled); from-address
  guides@rvkfoodie.is needs domain verification.
- Turnstile PUNTED → GitHub issue #2 (hostname blocker; approach recorded;
  revisit when spam is real).
