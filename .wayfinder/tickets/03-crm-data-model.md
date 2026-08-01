# CRM data model

`wayfinder:task` — blocking: none

## Question

Implement the agreed business-first CRM in `src/schema.ts` + result-rpc
procedures (execution — shape decided in map.md): `businesses`, `hotels`
(secondary properties carrying the pin), `contacts` (business-first,
hotelId nullable), `deals` (annual subscription: stage, pricePerRoom,
annualValue, startDate, renewalDate).

Pipeline: prospect → contacted → sample-sent → proposal → won → lost.
Canonical CRM naming, not hotel-specific. Outreach history folds into
notes. Deals.notes carries the outreach log. SPA surfaces: business detail
with hotels/contacts/deals tabs, deal stage changes as a mutation, renewal
date computed from startDate + 1 year.
