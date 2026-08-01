# Venue data model

`wayfinder:task` — blocking: 01-standard-venue-categories

## Question

Implement the agreed venue data model in `src/schema.ts` (execution — the
shape decisions are made and recorded in map.md): the `venues` table, the
`venue_lifecycle_events` table, and the generic `audit_log` table.

Pins: id (CUID2), name, category (from ticket 01), status
(draft/live/closed), orderKey (fractional-index); cuisine, price level,
tags, note, recommended dishes, lastVerifiedAt, confidence, source; address,
lat, lon; googlePlacesId; dineoutId; openingHours (free text); photo refs
into R2. No neighborhood, no walking distance. Lifecycle events: venueId,
type (closed/temporarily-closed/reopened), startedAt, endedAt, note.
Audit log: actor, action, entityType, entityId, before/after (JSON), at.

Also: result-rpc Venue entity model + the read procedures the SPA and guide
page need, audit writes on every mutation.
