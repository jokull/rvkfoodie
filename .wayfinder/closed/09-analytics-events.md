# Analytics events

`wayfinder:task` — blocking: 06-guide-page

## Question

Implement `guide_events` (decided in map.md):

- Table: id, guideId, hotelId, event type (`view` / `qr-scan` /
  `venue-click` / `email-captured`), venueId (nullable), happenedAt.
- Route-side beacon: a result-rpc mutation fired fire-and-forget from the
  guide page; `?src=qr` on the QR URL distinguishes scans from typed/linked
  visits (no redirect hop).
- SPA aggregates (raw numbers, no chart library): views/QR per guide over
  time, popular venues (click-through), email captures.
- Not built: PostHog (future switch when the business is serious — the
  table is the source of truth until then).

## Resolution (claimed 2026-08-01)

- guide_events table + events.record procedure (fire-and-forget).
- Beacon in the guide page: view / qr-scan on mount (?src=qr distinguishes),
  venue-click on card links, email-captured on capture success.
- SPA raw aggregates (views/QR per guide, popular venues, captures) land
  with the internal SPA (ticket 11) — the table and beacon are in.
