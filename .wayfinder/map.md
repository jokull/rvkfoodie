# Map: rvkfoodie — build-ready V1 spec carrying execution

`wayfinder:map`

## Destination

A **build-ready V1 spec** for Reykjavík Foodie: the editorial venue database,
the drafting-engine guide generator (per-hotel snapshots, staff-customizable),
the business-first hotel CRM, the monthly editorial pass, and the legacy
venue backfill. Precise enough that execution sessions build without
re-deciding anything. **Execution is carried into this map** (overrides
wayfinder's plan-don't-do default) — tickets graduate from decisions into
build tickets as the frontier resolves.

## Notes

- Domain: B2B SaaS selling curated, always-current food guides to Reykjavík
  hotels (annual subscription, pricePerRoom × rooms). The recurring
  maintenance is the product, not the initial guide.
- Skills: `.agents/skills/wayfinder`; grilling inline (see `grill-me` skill).
- Reference: business model doc (V1 scope), `.oldsite/` legacy archive,
  `d1/tables/*.sql` dumps (block_venue has coords, opening-hours text, image
  refs), `data/venue-data.json`.
- Stack is LOCKED (scaffold committed): TanStack Start (Vite 8) on Cloudflare
  Workers via `@cloudflare/vite-plugin`; Drizzle `1.0.0-rc.4` + D1
  (`rvkfoodie-cms-v4b`, shared with legacy schema — legacy tables untouched
  until ticket 04 lands, then dropped); result-rpc typed RPC (contract in
  `src/contract.ts`, handlers in `src/rpc-server.ts`, createServerFn
  prefetch + hydration); `wrangler types`; EMAIL send_email binding (beta);
  CUID2 ids server-side; fractional-index ordering (BASE_62, BINARY-safe
  verified); internal SPA UI `@cloudflare/kumo` + `@phosphor-icons/react`;
  forms `@formisch/react` (valibot, schema-first); Turnstile.

## Tickets

03 [CRM data model](tickets/03-crm-data-model.md) — task. Blocks 11.
04 [Legacy venue backfill](tickets/04-legacy-venue-backfill.md) — task.
05 [Guide model + drafting engine](tickets/05-guide-model-drafting-engine.md)
   — grilling. Blocks 06, 12.
06 [Guide page: /g/<slug>](tickets/06-guide-page.md) — prototype. Blocks 09.
07 [Email: binding ops + capture flow](tickets/07-email-capture.md) — task.
08 [R2 photo uploads](tickets/08-r2-photo-uploads.md) — task.
09 [Analytics events](tickets/09-analytics-events.md) — task.
10 [Auth: better-auth on D1 + Start SSR](tickets/10-auth-better-auth.md) —
   research. Blocks 11.
11 [Internal SPA screens](tickets/11-internal-spa-screens.md) — grilling.
12 [Monthly pass + digest](tickets/12-monthly-pass-digest.md) — task.

## Decisions so far

- **Venue categories (closed ticket 01)** — seven fixed categories:
  breakfast-brunch, cafe, bakery, restaurant, bar, street-food,
  sweet-treats. Venues carry a required primary + optional secondary
  category; drafting counts each venue once (renders under primary,
  secondary is tag + balance tiebreak), no double-counting.
- **Venue data model (closed ticket 02)** — venues + lifecycle + audit
  tables implemented per the model decisions; wire.enum deferred to the
  next result-rpc publish (enumOf = union of literals meanwhile).

- V1 deliverable — mobile web guide per hotel at `/g/<slug>` + QR code; PDF
  rendering and the wider product offering punted. *(ticket 06)*
- Offline/"keeping" — guide pages get an "email me this guide" capture; the
  guide ships as an HTML email via the EMAIL binding (no 4G, forgot the
  URL). Turnstile protects the form. *(tickets 06, 07)*
- Venue model — id (CUID2), name, category, status, orderKey; cuisine, price
  level, tags, note, recommended dishes, last-verified, confidence, source;
  address + lat/lon; google places id; dineoutId (Dineout deep-link);
  opening hours as free TEXT; photos via R2 presigned-URL uploads (out of
  band). NO neighborhood, NO walking distance. *(ticket 02)*
- Lifecycle table — venue lifecycle events (closed / temporarily closed /
  reopened) feeding "out of business" detection. Audit table — generic
  action log. *(ticket 02)*
- CRM — business-first, canonical: `businesses` → `hotels` (secondary, FK,
  carries the pin) → `contacts` (business-first, hotelId nullable,
  isDecisionMaker) → `deals` (annual subscription: stage, pricePerRoom,
  annualValue = pricePerRoom × rooms, startDate, renewalDate). Pipeline:
  prospect → contacted → sample-sent → proposal → won → lost. Outreach
  history in notes; no separate outreach table. *(ticket 03)*
- Guide architecture — per-hotel guides are SNAPSHOTS from a drafting
  engine: generator drafts, staff customize completely (relaying hotel
  asks). NOT generated-on-read. Fixed standard-category template for every
  guide (grouped at render); editorial text blocks deferred. Venue cards
  carry canonical default copy, overridable per guide. *(tickets 05, 06)*
- Generator rule — radius (default ~15–20 min walk from hotel pin,
  overridable) → quality gate (status=live, confidence ≥ 0.7, verified
  within 6 months) → balance (target count ~20–30, category spread) →
  overrides (featured always-in, excluded never-in, count/radius).
  Deterministic server-side. *(ticket 05)*
- Confidence — 0–1 editorial score, set in the monthly pass / backfill;
  lifecycle events override mechanically (closure → 0, reopened clears);
  manual re-verification otherwise. *(tickets 02, 12)*
- Backfill — venues ONLY: `block_venue` (~55, dedupe by name, prefer fullest
  entry) + `data/venue-data.json`. Old guides are NOT backfill material.
  Golden Circle entries need geocoding. Images via assets refs. *(ticket 04)*
- Auth — better-auth: email OTP (+ optional password, long-lived cookie),
  single access tier (two founders, no roles), NOT Cloudflare Access. OTP
  via EMAIL binding. *(ticket 10)*
- Guide URL/security — `https://rvkfoodie.is/g/<slug>`, no vanity
  subdomains (future upsell), noindex, public (not walled), security by
  obscurity; future gate (email-triggered delivery or room-number+email)
  only if harvesting becomes real. *(ticket 06)*
- Sales sample — the pitch artifact IS the guide: drafting engine runs for
  prospects, guide sits in draft, `/g/<slug>` URL is shareable (public
  anyway); small "sample" footer marker for non-customer drafts. *(ticket 06)*
- Analytics — `guide_events` (view / qr-scan / venue-click /
  email-captured, venueId nullable) via route-side beacon; QR encodes
  `?src=qr`; SPA shows raw aggregates. PostHog only when the business is
  serious. *(ticket 09)*
- Map — Leaflet + OpenStreetMap for MVP; Google Maps later. *(ticket 06)*
- Monthly pass — manual, editor-driven, against the FULL venue inventory
  (due-for-verification queue, closure candidates, new-openings triage);
  finish → email digest to affected hotels; guides update by re-running the
  drafting engine. Future: "in business" automation, cron. *(ticket 12)*

## Not yet specified

- Marketing home for rvkfoodie.is: out-of-product or in-scope for sales
  outreach? (No decision yet — the guide page is the product surface.)
- R2 bucket layout / serving path detail (ticket 08 decides).
- Guide builder and monthly pass route/UI structure (ticket 11 decides).
- New-openings intake source for the monthly pass (ticket 12 decides).

## Out of scope

- PDF generation, printable versions (punted — revisit post-validation).
- Multi-city franchise tooling, local-creator network (post-V1).
- AI concierge, public API, advanced automation.
- AI-assisted outreach drafting / prospect discovery / room-count
  estimation (business doc's "sneak in later" pile).
- Vanity subdomains (future paid feature).
- Google Maps rendering (future switch), PostHog (future).
- Scheduled cron automation of the monthly pass (future).
