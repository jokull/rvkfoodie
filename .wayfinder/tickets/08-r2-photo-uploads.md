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
