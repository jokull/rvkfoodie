# rvkfoodie.is

Insider food guides for Reykjavík and Iceland. Built with vinext (React RSC), agent-cms, and Cloudflare Workers.

## Architecture

```
www.rvkfoodie.is          → vinext SSR on Cloudflare Workers
agent-cms (in-process)    → GraphQL CMS with D1 + R2 + Vectorize
media.rvkfoodie.is        → R2 custom domain (image CDN)
```

Single Cloudflare Worker runs both the vinext frontend and agent-cms in-process. No separate CMS deployment needed — the CMS handler is imported directly and called via `cms.fetch()` / `cms.execute()`.

## Stack

- **Frontend**: vinext (React RSC on Vite), Tailwind v4, TypeScript
- **CMS**: agent-cms with GraphQL API, gql.tada for typed queries
- **Database**: Cloudflare D1 (SQLite)
- **Media**: Cloudflare R2 with custom domain
- **Search**: Cloudflare Vectorize (semantic search)
- **Sessions**: Cloudflare KV
- **Payments**: Gumroad license key verification
- **Linting**: oxlint with type-aware checking (via tsgo)

## Content model

- **Guides** — food/drink guides with nested Section and Venue blocks. Each venue has an `isFree` toggle controlling the paywall.
- **Editorials** — blog posts with structured text, hero image, and inline image blocks.
- **Changelog** — guide update entries (added/removed/updated) linked to a guide.

## Development

```bash
pnpm install
pnpm dev             # Vite dev server with workerd runtime
pnpm check           # Lint + typecheck (oxlint --type-aware --type-check)
pnpm build           # Production build
```

## Deploy

```bash
pnpm deploy          # D1 migrations + build + wrangler deploy
```

Secrets are managed via `wrangler secret`:
- `CMS_WRITE_KEY` — agent-cms write key
- `OAUTH_SECRET` — editor OAuth signing secret
- `EDITOR_PASSWORD` — editor login password

## Cloudflare resources

| Resource | Name | Purpose |
|---|---|---|
| Worker | `rvkfoodie` | Frontend + CMS (single Worker) |
| D1 | `rvkfoodie-cms-v2` | CMS database |
| R2 | `rvkfoodie-cms` | Media storage |
| KV | `rvkfoodie-session` | Sessions + purchases |
| Vectorize | `rvkfoodie-search` | Semantic search index |
| Domain | `www.rvkfoodie.is` | Frontend |
| Domain | `media.rvkfoodie.is` | R2 image CDN |
