# Internal SPA screens

`wayfinder:grilling` — blocking: 03-crm-data-model, 10-auth-better-auth

## Question

Pin the internal SPA's screen inventory and route map, then build it
(Kumo components, Formisch forms, result-rpc procedures):

Proposed screens (each a route under `/app`):

- **Dashboard** — the analytics aggregates (ticket 09): views/QR per guide,
  popular venues, captures; plus a monthly-pass due-count.
- **CRM** — business list (searchable), business detail with hotels /
  contacts / deals tabs, deal stage changes, contact + deal forms
  (Formisch).
- **Venues** — inventory list with status/lifecycle filters, venue detail
  (edit form, photo upload via ticket 08, lifecycle events, confidence +
  last-verified editing), audit trail.
- **Guide builder** — per-hotel: drafting-engine run, snapshot review
  (reorder/pin/exclude/override text), radius/count config, publish →
  live.
- **Monthly pass** — the review queue: due-for-verification, closure
  candidates (lifecycle), new-opening triage; finish → digest email.

Grill: is this the screen set for V1 (cut anything?), the route map, and
whether the guide builder and monthly pass share one route or split.

## Venue CRUD scope (locked 2026-08-01, grilling with user)

agent-cms inference closed four gaps before building the Venues screen:
- website + phone columns added to the venue model (agent-cms had both;
  the backfill had silently dropped 19/17 values) — CRUD + guide page
  Visit/Call links live.
- venue_awards CRUD procedures (list/add/remove; unique per venue+type,
  duplicate → 409) — awards are maintainable, not read-only.
- updateVenue now accepts confidence + lastVerifiedAt (staff fields) for
  the maintenance workflow.
- No hard delete: soft via status (closed excludes from drafting + the
  guide view), audit trail is the record. agent-cms had no hard delete
  either (draft/versions).
Venues screen = list w/ status+lifecycle filters, edit form (incl. the
above), lifecycle events, audit trail, photo manager (ticket 08).

## Progress (2026-08-01)

- Venues screen (list + detail + add dialog) and CRM screens (business list +
  detail with hotels/contacts/deals) are live under /app.
- Guide builder live: /app/guides list with create-picker, /app/guides/$id
  with config (radius/target), run-draft, grouped snapshot review (reorder
  via fractional orderKeys between neighbors, pin, override text, exclude),
  approve pending, publish, exclude management. New procedures:
  guides.builder (staff-gated snapshot query) + guideVenues.update
  (reorder/pin/override, affects builder + public view).
- Remaining: monthly pass screen (ticket 12 queue).

- Monthly pass screen live (queue + actions) — completes the SPA surface. Ticket 11 CLOSED.
