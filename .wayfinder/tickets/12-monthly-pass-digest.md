# Monthly pass + digest

`wayfinder:task` — blocking: 02-venue-data-model, 05-guide-model-drafting-engine,
11-internal-spa-screens

## Question

Implement the manual monthly editorial pass (decided in map.md — manual for
now, automation later):

- Review queue over the FULL venue inventory: venues due for verification
  (lastVerified older than threshold), closure candidates (lifecycle
  events / status signals), new-openings triage (from where? venue-data.json
  style collections or manual entry — pin the intake source here).
- Actions in the pass: re-verify (bump lastVerifiedAt + confidence),
  mark closed / temporarily closed (writes lifecycle event, status drops),
  add venues, adjust confidence.
- Finish → email digest to affected hotels via the EMAIL binding ("your
  guide now includes X; Y was removed") — draft + regenerate per-hotel
  guides happens in the guide builder (ticket 05/06), not here.
- Future (not built): "in business" detection automation, cron.

## Progress (2026-08-01) — CLOSED

- Pass screen live at /app/pass (queue + re-verify/close/reopen + min-confidence filter) — ticket 11 scope.
- Digest implemented: `guides.digest` (staff-gated). Diffs each live guide against the last digest's
  live-venue baseline, emails affected hotels via the EMAIL binding. First run snapshots the baseline
  silently; afterwards only real changes mail: removals = venue closures (silent draft disqualifiers)
  plus anything the hotel was told about that left the guide; additions = newly live rows. Recipients
  resolve hotel-scoped contacts, falling back to business contacts. Guides carry `lastDigestAt` +
  `lastDigestVenueIds` (migration `20260801205455_warm_lionheart`).
- e2e: first-run snapshot, closure → removed, reopen → re-added, steady state → silent (71 assertions).
- Remaining (ops, not build): apply migrations to remote D1 before deploy; verify the
  guides@rvkfoodie.is from-address (ticket 07 ops) so digest mail actually lands.
