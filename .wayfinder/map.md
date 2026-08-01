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
  until the backfill ticket lands, then dropped); result-rpc typed RPC
  (contract in `src/contract.ts`, handlers in `src/rpc-server.ts`,
  createServerFn prefetch + hydration); `wrangler types`; EMAIL send_email
  binding (beta); CUID2 ids server-side; fractional-index ordering
  (BASE_62, BINARY-safe verified); internal SPA UI `@cloudflare/kumo` +
  `@phosphor-icons/react`; forms `@formisch/react` (valibot, schema-first).

## Decisions so far

- V1 deliverable — mobile web guide per hotel at `/g/<slug>` + QR code; PDF
  rendering and the wider product offering punted.
- Offline/"keeping" — guide pages get an "email me this guide" capture; sends
  the guide as an HTML email via the EMAIL binding (no 4G, forgot the URL).
- Venue model — id (CUID2), name, category, status, orderKey; cuisine, price
  level, tags, note, recommended dishes, last-verified, confidence, source;
  address + lat/lon; google places id; dineoutId (Dineout booking deep-link);
  opening hours as free TEXT; photos via R2 presigned-URL uploads (out of
  band). NO neighborhood field, NO walking-distance field.
- Lifecycle table — venue lifecycle events (closed / temporarily closed /
  reopened) feeding "out of business" detection.
- Audit table — generic action log.
- CRM — business-first, canonical terminology: `businesses` (account) →
  `hotels` (secondary, optional, FK businessId, carries the pin: address +
  lat/lon) → `contacts` (business-first, hotelId nullable, isDecisionMaker)
  → `deals` (annual subscription: stage, pricePerRoom, annualValue =
  pricePerRoom × rooms, startDate, renewalDate). Pipeline:
  prospect → contacted → sample-sent → proposal → won → lost. Outreach
  history folded into notes; no separate outreach table in V1.
- Guide architecture — per-hotel guides are SNAPSHOTS from a drafting
  engine: the generator drafts, staff then customize completely (relaying
  hotel asks). Not generated-on-read. Venue cards carry canonical default
  copy, overridable per guide.
- Generator rule — radius (default ~15–20 min walk from hotel pin,
  overridable) → quality gate (status=live, confidence, freshness) → balance
  (target count, category spread) → overrides (featured always-in, excluded
  never-in, count/radius). Deterministic server-side.
- Backfill — venues ONLY from legacy: `block_venue` (~55 blocks, dedupe by
  name, prefer fullest entry) + `data/venue-data.json`. Old guides are NOT
  backfill material. Coordinates mostly present; Golden Circle entries need
  geocoding. Images via assets refs (media.rvkfoodie.is / R2).
- Auth — better-auth: email OTP (+ optional password, long-lived cookie),
  single access tier (no roles — just the two founders), NOT Cloudflare
  Access. OTP delivery via EMAIL binding.
- Guide URL/security — `https://rvkfoodie.is/g/<slug>`, no vanity subdomains
  (future upsell), noindex, page public (not walled), security by obscurity;
  future gate (email-triggered delivery or room-number+email) only if
  harvesting becomes a real problem.
- Analytics — `guide_events` table (view / qr-scan / venue-click /
  email-captured, venueId nullable, happenedAt) via route-side beacon; QR
  encodes `?src=qr` to count scans without a redirect hop; SPA shows raw
  aggregates. PostHog only when the business is serious (not now).
- Map — Leaflet + OpenStreetMap for MVP; move to Google Maps later.
- Monthly pass — manual, editor-driven review against the FULL venue
  inventory (due-for-verification queue, closure candidates from lifecycle,
  new-openings triage); future automation for "in business" detection.
  Email digest to affected hotels after a pass; guides update by re-running
  the drafting engine per hotel (snapshots).

## Not yet specified

- Guide sectioning: does the drafting engine group venues (by category /
  proximity ring / itinerary) and do guides carry editorial text blocks
  (intro, tips) like the old site's sections did?
- Confidence score mechanics: what feeds it, how it's assigned in V1.
- Email-capture abuse handling: rate limits, honeypots, from-address
  verification (send_email beta needs a verified domain/address).
- R2 presigned-upload flow: bucket layout, key scheme, who uploads, image
  variants.
- Hotel guide config surface in the SPA (radius, count, featured/excluded,
  brand colors/logo).
- The sales pitch artifact: is the personalized sample guide the same
  `/g/<slug>` page in draft, or a separate shareable export?
- Internal SPA route/screen inventory (dashboard, CRM, inventory, guide
  builder, monthly pass).
- Public marketing home for rvkfoodie.is (out-of-product or in-scope for
  sales outreach?).

## Out of scope

- PDF generation, printable versions (punted — revisit post-validation).
- Multi-city franchise tooling, local-creator network (post-V1).
- AI concierge, public API, advanced automation.
- AI-assisted outreach drafting / prospect discovery / room-count
  estimation (business doc's "sneak in later" pile).
- Vanity subdomains (future paid feature).
- Google Maps rendering (future switch), PostHog (future).
- Scheduled cron automation of the monthly pass (future).
