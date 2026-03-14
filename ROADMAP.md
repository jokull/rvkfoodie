# rvkfoodie.is Roadmap

## Purpose

rvkfoodie.is is the home of Reykjavík's most trusted local food and nightlife guides. Today these guides live on Gumroad as downloadable PDFs — invisible to search engines and disconnected from the brand's own domain.

We're rebuilding rvkfoodie.is as a content-first site where each guide lives as a rich, browsable page on our own domain. Unauthorized visitors see a generous SEO-friendly preview — real venue names, real descriptions, enough to rank on Google and prove the guide is legit. Paying customers unlock the full guide with all venues, tips, and the Google Maps pin list.

The unlock flow is frictionless: buy on Gumroad, get a license key, enter it on the site, done. No accounts, no passwords. Astro 6 built-in sessions (backed by Cloudflare KV, auto-provisioned) remember the browser so they only enter the key once.

**Guides at launch:**
- Reykjavík Food Guide — 4 sections (Breakfast & Coffee, Lunch, Dinner, Drinks) + Before You Go tips (free)
- Reykjavík Bar Crawl — timed itinerary (5PM → late night), 6+ stops
- Golden Circle Food Guide — 9 venue stops along the route + pacing tip
- Reykjavík Food & Bar Bundle — unlocks Food Guide + Bar Crawl (bundle gives separate keys per product)

**Preview strategy:** Per-venue `is_free` boolean in DatoCMS. Editors toggle which venues are free preview vs. paywalled. Text blocks also have `is_free` for tips/intros.

**Stack:** Astro 6 SSR, `@astrojs/cloudflare` adapter, DatoCMS (GraphQL CDA + `@datocms/astro` components), Astro built-in sessions (Cloudflare KV), Gumroad license key verification API, Tailwind v4

**CMS schema:**
- `📖 Guide` — title, slug, subtitle, description, price, Gumroad product ID/URL, Google Maps URL, SEO, content (modular blocks)
- `📂 Section` block — title + nested Venue blocks
- `📍 Venue` block — name, address, description, note, time, `is_free` boolean
- `📝 Text Block` — heading, structured text body, `is_free` boolean
- `✏️ Editorial` — blog posts/restaurant reviews (title, slug, excerpt, structured text, image, date)
- `🏠 Home Page` — singleton with SEO and featured editorial link

**Gumroad product IDs:**
- Food Guide: `2XvImS0EDlgIJTnyND9IPg==` ($15)
- Bar Crawl: `Nh29BBzZgbR9j_zbd7G6gQ==` ($5)
- Golden Circle: `tQ2p0Rc-AOTIB9MbCgUAug==` ($12)
- Bundle: `vV5i0_395VCDyRZPNuw2gQ==` ($17) — contains Food Guide + Bar Crawl

## Todo

- [ ] Editorial/blog pages (render DatoCMS editorials with StructuredText + Image)
- [ ] Homepage: integrate DatoCMS Home Page singleton (featured editorial, SEO)
- [ ] SEO: wire up DatoCMS `_seoMetaTags` and `faviconMetaTags` into `<head>`
- [ ] Photos from Instagram added to venues/editorials
- [ ] Design polish and responsive testing
- [ ] Publish guide records in DatoCMS (currently drafts)

## Done

- [x] Purchased domain rvkfoodie.is
- [x] Existing Gumroad products set up and selling
- [x] Brand assets (logo.svg, instagram.svg, color palette #FCF8EC / #5071FE)
- [x] All guide content written — Food Guide, Bar Crawl, Golden Circle
- [x] Decided on auth: Gumroad license keys + Astro 6 built-in sessions (Cloudflare KV)
- [x] Defined preview cutoff via `is_free` boolean per venue/block in DatoCMS
- [x] Extracted all Gumroad product IDs and bundle structure
- [x] Scaffolded Astro 6 + Cloudflare Workers + Tailwind v4 project
- [x] Guide page template with preview/gated split and paywall CTA
- [x] License key unlock endpoint (POST → Gumroad verify → session)
- [x] Landing page with guide cards and bundle CTA
- [x] Deployed to Cloudflare Workers (rvkfoodie.solberg.workers.dev + www.rvkfoodie.is)
- [x] DNS migrated from GitHub Pages to Cloudflare
- [x] DatoCMS: scrubbed Somm, adopted for rvkfoodie (renamed site, models, deleted Shopify stuff)
- [x] DatoCMS: created Guide model with Section/Venue/TextBlock blocks
- [x] DatoCMS: populated all 3 guides with full venue data and free/paid flags
- [x] Astro: integrated DatoCMS via GraphQL CDA (`@datocms/cda-client` + `@datocms/astro`)
- [x] Astro: StructuredText rendering for text blocks
- [x] Removed MDX content collections — all content now in DatoCMS
- [x] DATOCMS_API_TOKEN set as Cloudflare Workers secret
