# AGENT.md

Reykjavík Foodie — curated food guides sold to hotels as an annual B2B subscription.

- Stack, scripts, and architecture rules live in README.md and code headers.
- Identity: CUID2 (`@paralleldrive/cuid2`), generated server-side. Curated
  ordering: fractional-index keys (`fractional-indexing`), client-computable.
- Internal SPA UI: `@cloudflare/kumo` components + `@phosphor-icons/react`;
  forms: `@formisch/react` (schema-first, valibot) — form schemas map onto
  result-rpc procedure inputs.
- Plan big work through the wayfinder map (`.wayfinder/map.md`): resolve one
  ticket per session, never more (research tickets excepted).
- The D1 database is shared with a legacy agent-cms schema (`content_*`,
  `block_*`, `fts_*` tables). Do not touch those tables until the backfill
  ticket in `.wayfinder` lands; new tables come from `src/schema.ts`.
- Bindings: `import { env } from 'cloudflare:workers'` (server-only); types
  regenerate with `pnpm cf-typegen` after wrangler.jsonc changes.
