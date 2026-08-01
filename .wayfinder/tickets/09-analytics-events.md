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
