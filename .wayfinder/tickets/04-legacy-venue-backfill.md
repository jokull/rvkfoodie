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
