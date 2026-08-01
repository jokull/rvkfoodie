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
