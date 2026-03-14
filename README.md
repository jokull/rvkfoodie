# rvkfoodie.is

Insider food guides for Reykjavík and Iceland. Built with Astro 6, Payload CMS, and Cloudflare.

## Architecture

```
www.rvkfoodie.is          → Astro 6 SSR on Cloudflare Workers
rvkfoodie-cms.solberg.workers.dev → Payload CMS on Cloudflare Workers + D1
media.rvkfoodie.is        → R2 custom domain (image CDN)
```

The Astro frontend fetches content from Payload's REST API at request time. Images are served directly from R2 via a custom domain — no Worker in the image path.

## Stack

- **Frontend**: Astro 6, Tailwind v4, TypeScript
- **CMS**: Payload CMS with Lexical rich text editor
- **Database**: Cloudflare D1 (SQLite)
- **Media**: Cloudflare R2 with custom domain
- **Sessions**: Astro built-in sessions backed by Cloudflare KV
- **Payments**: Gumroad license key verification

## Content model (Payload CMS)

- **Guides** — food/drink guides with nested Section and Venue blocks. Each venue has an `isFree` toggle controlling the paywall.
- **Editorials** — blog posts with Lexical rich text, hero image, and inline image uploads.
- **Changelog** — guide update entries (added/removed/updated) linked to a guide.
- **Media** — image uploads stored in R2.

## Pages

| Route | Description |
|---|---|
| `/` | Homepage — collage, guide cards, blog feed |
| `/guides/[slug]` | Guide page with preview/paywall split |
| `/blog/[slug]` | Editorial/blog post |
| `/places/[id]` | Individual venue page (SEO) |
| `/about` | About the author |
| `/changelog` | Guide updates timeline |
| `/api/unlock` | POST — license key verification via Gumroad |
| `/sitemap.xml` | Dynamic sitemap |

## Paywall flow

1. Visitor sees free preview venues (marked `isFree: true` in CMS)
2. Gated venues show "+N more in the full guide"
3. Visitor buys on Gumroad → gets license key
4. Enters key on site → `POST /api/unlock` verifies with Gumroad API
5. Product ID stored in Astro session (Cloudflare KV)
6. Full guide unlocked on reload

## Development

```bash
npm install
npm run dev          # Astro dev server with workerd runtime
```

Requires a running Payload CMS instance. Set `PAYLOAD_URL` in `.env` or the default (`https://rvkfoodie-cms.solberg.workers.dev`) is used.

## Deploy

```bash
npm run deploy       # builds Astro + deploys to Cloudflare Workers
```

The Payload CMS is a separate project at `../rvkfoodie-cms/`. Deploy it independently:

```bash
cd ../rvkfoodie-cms
pnpm run deploy
```

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `PAYLOAD_URL` | Astro `.env` | Payload CMS API URL |
| `PAYLOAD_SECRET` | CMS Worker secret | Payload encryption key |
| `DATOCMS_API_TOKEN` | Legacy, can remove | Was used for DatoCMS |
| `GUMROAD_APP_ID` | Astro `.env` | Gumroad OAuth (fallback) |
| `GUMROAD_APP_SECRET` | Astro `.env` | Gumroad OAuth (fallback) |

## Cloudflare resources

| Resource | Name | Purpose |
|---|---|---|
| Worker | `rvkfoodie` | Astro frontend |
| Worker | `rvkfoodie-cms` | Payload CMS |
| D1 | `rvkfoodie-cms` | Payload database |
| R2 | `rvkfoodie-cms` | Media storage |
| KV | `rvkfoodie-session` | Astro sessions |
| Domain | `www.rvkfoodie.is` | Frontend |
| Domain | `media.rvkfoodie.is` | R2 image CDN |

## Image pipeline

Images are uploaded through Payload CMS admin → stored in R2 → served via `media.rvkfoodie.is` custom domain. The `mediaUrl()` helper in `src/lib/images.ts` converts Payload media URLs to R2 URLs. The Lexical rich text renderer (`src/lib/lexical.ts`) handles `upload` nodes and outputs `<img>` tags pointing to R2.

## Gumroad products

| Product | ID | Price |
|---|---|---|
| Food Guide | `2XvImS0EDlgIJTnyND9IPg==` | $15 |
| Bar Crawl | `Nh29BBzZgbR9j_zbd7G6gQ==` | $5 |
| Golden Circle | `tQ2p0Rc-AOTIB9MbCgUAug==` | $12 |
| Bundle | `vV5i0_395VCDyRZPNuw2gQ==` | $17 |
