# Guide page: /g/<slug>

`wayfinder:prototype` — blocking: 02-venue-data-model, 05-guide-model-drafting-engine

## Question

Build the public guide page and its route (execution + one prototype to
react to):

- Route `/g/<slug>`: server-rendered, noindex, public (not walled). Loads
  the guide snapshot + hotel config + venues; result-rpc prefetch +
  hydration like the home route.
- Page: generated intro ("within a 20-minute walk of [hotel]"), Leaflet/OSM
  map with hotel pin + venue pins + radius ring, venue cards grouped by
  standard category (name, category, address, opening-hours text, note,
  recommended dishes, Dineout "reserve" deep-link from dineoutId, award
  badges), fixed footer with "made for [hotel]" + the email-capture form
  (Turnstile — keys ops live in ticket 07).
- QR: encodes `https://rvkfoodie.is/g/<slug>?src=qr`; the QR generation
  library choice is a small research decision (qrcode / qrcode.react /
  server-side SVG).
- Sample marker: drafts of non-customer hotels show a small "sample" marker
  in the footer.
- Beacon: fire `guide_events` (view / qr-scan / venue-click) per ticket 09.

Prototype first: a rough static mock of the mobile guide page (venue cards
+ map + capture) for the user to react to before wiring data.
