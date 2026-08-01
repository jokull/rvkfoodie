# Standard venue categories

`wayfinder:grilling` — blocking: none

## Question

What is the fixed category taxonomy the drafting engine's standard template
groups venue cards by, and every venue's `category` value draws from?

Context: venue category is a single text column; the template renders fixed
category sections (e.g. Breakfast & Brunch, Cafés, Dinner, Bars) by grouping
the guide's ordered venue list. Categories must be broad enough that a
20-minute-walk radius of a downtown Reykjavík hotel reliably fills several,
narrow enough that a section reads coherently on a phone.

Candidate shape: restaurant / cafe / bakery / bar / street-food /
sweet-treats / fine-dining, or the old site's implicit grouping (breakfast,
lunch, dinner, sweet treats, bars). The answer also drives the generator's
category-balance step and the backfill mapping (legacy `block_venue` entries
carry no category field today — category must be assigned during backfill).
