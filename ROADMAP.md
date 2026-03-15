# rvkfoodie.is Roadmap

## Purpose

rvkfoodie.is is the home of Reykjavík's most trusted local food and nightlife guides. Today these guides live on Gumroad as downloadable PDFs — invisible to search engines and disconnected from the brand's own domain.

We've rebuilt rvkfoodie.is as a content-first site where each guide lives as a rich, browsable page on our own domain. Unauthorized visitors see a generous SEO-friendly preview — real venue names, real descriptions, enough to rank on Google and prove the guide is legit. Paying customers unlock the full guide with all venues, tips, and the Google Maps pin list.

The unlock flow is frictionless: buy on Gumroad, get a license key, enter it on the site, done. No accounts, no passwords. Astro 6 built-in sessions (backed by Cloudflare KV) remember the browser so they only enter the key once.

**Guides at launch:**
- Reykjavík Food Guide — 4 sections (Breakfast & Coffee, Lunch, Dinner, Drinks) + Before You Go tips (free)
- Reykjavík Bar Crawl — timed itinerary (5PM → late night), 6+ stops
- Golden Circle Food Guide — 9 venue stops along the route + pacing tip
- Reykjavík Food & Bar Bundle — unlocks Food Guide + Bar Crawl

**Preview strategy:** Per-venue `isFree` boolean in Payload CMS. Editors toggle which venues are free preview vs. paywalled. Text blocks also have `isFree` for tips/intros.

**Stack:** Astro 6 SSR, `@astrojs/cloudflare` adapter, Payload CMS (REST API on Cloudflare Workers + D1), Cloudflare R2 (image storage), Astro built-in sessions (Cloudflare KV), Gumroad license key verification API, Tailwind v4

**CMS schema (Payload CMS):**
- `Guide` — title, slug, subtitle, description, price, Gumroad product ID/URL, Google Maps URL, content (Section and TextBlock blocks)
- `Section` block — title + nested Venue blocks
- `Venue` block — name, address, description, note, time, `isFree` boolean
- `TextBlock` — heading, Lexical rich text body, `isFree` boolean
- `Editorial` — blog posts/restaurant reviews (title, slug, excerpt, Lexical rich text, hero image, date)
- `Changelog` — guide update entries (date, title, description, changeType, linked guide)
- `Media` — image uploads stored in Cloudflare R2

**Gumroad product IDs:**
- Food Guide: `2XvImS0EDlgIJTnyND9IPg==` ($15)
- Bar Crawl: `Nh29BBzZgbR9j_zbd7G6gQ==` ($5)
- Golden Circle: `tQ2p0Rc-AOTIB9MbCgUAug==` ($12)
- Bundle: `vV5i0_395VCDyRZPNuw2gQ==` ($17) — contains Food Guide + Bar Crawl

## Todo

- [ ] Fix `media.rvkfoodie.is` R2 custom domain (requires moving nameservers to Cloudflare; using r2.dev public URL as interim)
- [ ] OG image (`/og-default.jpg`) missing from `/public/`
- [ ] Photos from Instagram added to venues/editorials
- [ ] Design polish and responsive testing
- [ ] SEO meta tags per page (guide-specific OG images, descriptions)

## Done

- [x] Purchased domain rvkfoodie.is
- [x] Existing Gumroad products set up and selling
- [x] Brand assets (logo.svg, color palette)
- [x] All guide content written — Food Guide, Bar Crawl, Golden Circle
- [x] Decided on auth: Gumroad license keys + Astro 6 built-in sessions (Cloudflare KV)
- [x] Defined preview cutoff via `isFree` boolean per venue/block in Payload CMS
- [x] Extracted all Gumroad product IDs and bundle structure
- [x] Scaffolded Astro 6 + Cloudflare Workers + Tailwind v4 project
- [x] Guide page template with preview/gated split and paywall CTA
- [x] License key unlock endpoint (POST → Gumroad verify → session)
- [x] Landing page with guide cards and blog feed
- [x] Deployed to Cloudflare Workers (www.rvkfoodie.is)
- [x] Migrated CMS from DatoCMS to Payload CMS (Cloudflare Workers + D1)
- [x] Migrated images from DatoCMS to Cloudflare R2
- [x] Payload CMS: Guide model with Section/Venue/TextBlock blocks
- [x] Payload CMS: populated all 3 guides with full venue data and free/paid flags
- [x] Astro: integrated Payload CMS via REST API (`src/lib/payload.ts`)
- [x] Lexical rich text rendering for text blocks and editorials (`src/lib/lexical.ts`)
- [x] Editorial/blog pages with hero images and inline image uploads
- [x] Homepage with photo collage, guide cards, and blog feed
- [x] Individual venue pages (`/places/[id]`) for SEO
- [x] Changelog page showing guide updates timeline
- [x] About page
- [x] Dynamic sitemap generation
- [x] R2 image serving via r2.dev public URL (interim fix)
