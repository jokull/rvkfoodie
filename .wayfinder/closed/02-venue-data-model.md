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

## Resolution (claimed 2026-08-01)

- schema.ts: `venues` (full editorial model per map decisions), 
  `venue_lifecycle_events`, `audit_log`; hotels unchanged.
- JSON list columns via text({mode:'json'}) + $type (tags, dishes, photos);
  confidence real 0..1 default 0 (new venues excluded from guides until
  reviewed); timestamps timestamp_ms.
- result-rpc: Venue entity (full shape, nullable fields via wire.nullable),
  LifecycleEvent, AuditEntry models. Procedures: feed/byId/add/update/
  setStatus/addLifecycleEvent/listLifecycle + audit.list.
- Lifecycle mechanics: closed/temporarily-closed → status closed +
  confidence 0; reopened → status live. Audit written on every mutation
  (best-effort, actor 'system' until auth lands).
- wire.enum not in published result-rpc 0.2.0 — used enumOf = wire.union
  of wire.literal (identical digest; swap to wire.enum on next publish).
- Migration regenerated from scratch (0001) — nothing deployed remotely.
