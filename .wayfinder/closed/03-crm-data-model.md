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

## Resolution (claimed 2026-08-01)

- schema.ts: businesses, hotels (businessId FK, address+pin, roomCount),
  contacts (business-first, hotelId nullable, isDecisionMaker), deals
  (stage, pricePerRoom, annualValue, startDate, renewalDate).
- annualValue computed server-side as pricePerRoom × total rooms across the
  business's hotels when not provided.
- Pipeline stages on deals, not hotels. Outreach history folds into notes.
- result-rpc: Business/Hotel/Contact/Deal models + list/byId/add/update
  procedures (hotels.listByBusiness, contacts.listByBusiness,
  deals.listByBusiness). Audit writes on every CRM mutation.
