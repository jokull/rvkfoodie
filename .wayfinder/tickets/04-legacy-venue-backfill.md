# Legacy venue backfill

`wayfinder:task` — blocking: 01-standard-venue-categories,
02-venue-data-model

## Question

Backfill the venues table from the legacy data (execution — venue-only, old
guides are NOT backfill material; the legacy tables stay until this lands,
then get dropped):

1. Dedupe ~55 `block_venue` records by normalized name, preferring the
   fullest entry (coords + opening-hours text + description + image ref).
2. Assign categories per ticket 01 (legacy records carry none).
3. Geocode the Golden Circle entries that lack coordinates (OSM Nominatim)
   and reconcile against `data/venue-data.json` (address + lat/lon).
4. Resolve image refs through the `assets` table to their
   media.rvkfoodie.is / R2 URLs; import photos via the R2 flow (ticket 08)
   or store the existing URLs directly.
5. Set confidence + lastVerifiedAt: the entries are recently curated
   (2026) — default confidence from curation recency, flagging anything
   with a `closed`-ish signal for review.
6. Run idempotently (dry-run diff first), audit-logged.

The per-table dumps in `.oldsite/d1/tables/` are the source; the live legacy
tables in D1 are the fallback for anything the dumps miss.

## Research prep (subagent findings, 2026-08-01)

- 47 unique venues after normalization (55 block rows across 4 guides).
- 38/47 have coords; 9 countryside entries need geocoding (Matkráin —
  address likely misspelled "Hvergardi"→Hveragerði — GK Bakarí, Friðheimar,
  Vínstofa Friðheima, Laugarás Lagoon, Pylsuvagninn, Rauða Húsið,
  Flúðasveppir, Tommi's Burger Joint).
- venue-data.json = 25 venues, all present in block data (strict subset) —
  authoritative coords/hours for those; no json-only venues.
- 29/47 have opening-hours text; 9 have resolvable image asset ids
  (r2 prefix uploads/{id}/); 5 best_of_award → tags; no dineout or gplaces ids.
- Alias to merge: "2guys" → "2guys at Hlemmur"; Kramber/Skreið address
  discrepancies (coords agree — prefer json coords).
- description → note; block note → recommended_dishes when it lists dishes.
- order_key: a0..a46 in first-appearance order (main → kids → countryside →
  night guides); idempotent on normalized name.
- confidence: high (json-verified 2026-03-15), medium (block-only + coords),
  low (countryside, geocode+pending). source: legacy:block_venue /
  legacy:venue-data.json.
