# Guide page: /g/<slug>

`wayfinder:prototype` — blocking: 02-venue-data-model, 05-guide-model-drafting-engine

## Question

Build the public guide page and its route (execution + one prototype to
react to):

- Route `/g/<slug>`: server-rendered, noindex, public (not walled). Loads
  the guide snapshot + hotel config + venues; result-rpc prefetch +
  hydration like the home route.
- Page: generated intro ("within a 20-minute walk of [hotel]"), Leaflet/OSM
  map with hotel pin + venue pins + radius ring, venue cards grouped by
  standard category (name, category, address, opening-hours text, note,
  recommended dishes, Dineout "reserve" deep-link from dineoutId, award
  badges), fixed footer with "made for [hotel]" + the email-capture form
  (Turnstile — keys ops live in ticket 07).
- QR: encodes `https://rvkfoodie.is/g/<slug>?src=qr`; the QR generation
  library choice is a small research decision (qrcode / qrcode.react /
  server-side SVG).
- Sample marker: drafts of non-customer hotels show a small "sample" marker
  in the footer.
- Beacon: fire `guide_events` (view / qr-scan / venue-click) per ticket 09.

Prototype first: a rough static mock of the mobile guide page (venue cards
+ map + capture) for the user to react to before wiring data.

## Resolution (claimed 2026-08-01)

- Route /g/$slug (server-rendered, noindex, public): loader prefetches the
  new guides.viewBySlug (slug-keyed public view — never exposes the id),
  ResultRpcHydrationBoundary hydrates; first paint has venue rows.
- Page: generated intro, category-grouped shortlist with editor's-pick
  marker on each section's first venue, venue cards (address, hours, note,
  recommended dishes, Directions + Dineout links), sample marker for draft
  guides, capture form.
- Map: plain leaflet dynamically imported in useEffect (SSR-safe — leaflet
  throws at import in workerd), divIcon pins (no icon-asset issues), OSM
  tiles with attribution.
- QR: /api/qr?slug=<slug> → SVG via `qrcode` (pure JS, workerd-safe) of
  https://rvkfoodie.is/g/<slug>?src=qr (slug-only input, no open proxy).
- Capture: guide_captures table + captures.request — records the capture
  and sends the guide as a table-based HTML email via the EMAIL binding
  (Message-ID + Date headers required by send_email). Turnstile + beta ops
  remain ticket 07.
- Contract version: dropped the manual contractVersion string on both
  sides — the computed contract digest is the version everywhere (SSR
  hydrate + wire stale-client), fixing a hydration mismatch.
- E2E extended: viewBySlug, capture (email sent via local emulation), QR.
  ALL E2E CHECKS PASSED.
