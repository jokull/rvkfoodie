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
