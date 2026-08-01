# R2 photo uploads

`wayfinder:task` — blocking: none

## Question

Pin and implement the out-of-band photo upload flow (execution — decided:
R2 uploads via presigned URLs, no in-request upload path):

- R2 bucket layout and key scheme (e.g. `venues/<id>/<n>.<ext>`), reuse of
  the existing `rvkfoodie-cms` bucket (legacy media lives there) vs. a new
  bucket.
- Presigned-URL flow: an SPA mutation requests an upload URL (object key
  derived server-side, content-type + size limits), the client PUTs to R2
  out of band, then a confirm mutation records the photo on the venue.
- Serving: existing `media.rvkfoodie.is` custom domain / public bucket
  access vs. Workers asset delivery.
- Image variants (thumbnail for cards, full for detail) or raw originals in
  V1.

Blocks nothing in the critical path (venue photos can be URL-referenced in
the meantime) but unblocks the backfill's photo import (ticket 04).

## Scope (locked 2026-08-01, grilling with user)

- Bucket: reuse the live legacy bucket `rvkfoodie-cms` (custom domain
  media.rvkfoodie.is + Image Resizing) — proven by the backfill photo wiring.
- Backfill established the serving pattern: `photos` stores raw CDN URLs,
  renderers append `cdn-cgi/image` options. Upload flow (ticket 08) will
  mint presigned PUTs for the same bucket and record the resulting URL.
- Key scheme + variants (thumbnail/full) still open; venue form also needs
  photo add/remove/reorder UI.

## Resolution (claimed 2026-08-01)

- Upload transport is the session-gated in-request route /api/upload for
  now (streams to the MEDIA binding on the legacy rvkfoodie-cms bucket).
  The decided presigned-PUT flow needs an R2 API token (dashboard) for
  SigV4 — ops-blocked; the key scheme + raw CDN URL contract are unchanged
  by the swap, so only the write path differs later.
- Key scheme: venues/<venueId>/<ts>-<safeName>. Content-type allowlist
  (jpeg/png/webp/heic/avif), 10 MB cap, 401/415/413 enforcement.
- Attach/remove = venues.update photos (entity patch — no new RPC needed).
- Photo manager UI on the venue detail (strip + upload + remove).
- e2e: 401 anonymous, 415 non-image, auth upload, CDN url shape, attach.
