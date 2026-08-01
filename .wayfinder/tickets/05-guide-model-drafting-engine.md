# Guide model + drafting engine

`wayfinder:grilling` — blocking: 01-standard-venue-categories

## Question

Pin the guide data model and the drafting-engine algorithm, then implement:

**Model (decided in map.md, to be pinned here):** per-hotel guide SNAPSHOT —
`guides` (hotelId, slug, status draft/live, generatedAt, radius, hotel brand
config, intro), `guide_venues` (guideId, venueId, orderKey, overrideText,
pinned/excluded flags from hotel overrides). Fixed standard-category
template: the ordered venue list groups by category at render. No
guide_sections table, no editorial text blocks.

**Algorithm (decided in map.md, detail to pin here):** radius (default
~15–20 min walk from the hotel pin, overridable) → quality gate
(status=live, confidence ≥ 0.7, verified within 6 months) → balance (target
count ~20–30, category spread — exact spread rule is this ticket's main
decision) → overrides (featured always-in, excluded never-in, count/radius
adjustment). Deterministic server-side; drafting produces a draft snapshot
staff then customize (reorder, override text, adjust radius/count, pin/
exclude) — relaying hotel asks.

Sub-decisions to grill: the category-balance rule (equal fill vs. cap per
category vs. priority order), what "target count" defaults to per radius,
and whether the itinerary-style "start here" opening (top 3–5) survives in
the fixed template or is dropped for a straight category grouping.
