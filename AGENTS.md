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

## hangar — the workbench around this repo

hangar is a read surface + control plane. It never runs your agent and never
writes code; it watches the files you write, owns the dev environment, and
holds the evidence. Query it; don't ask it to code.

- **Where to look**
  - `hangar.toml` — the manifest: services, setup, env policy, actions.
    `hangar doctor` validates it; changes to services/ports need
    `hangar down` + `hangar up` to take effect.
  - `.hangar/checks/` — executable check scripts; `hangar run`/`watch` run
    them all and mint receipts keyed to the **tree hash**.
  - `.hangar/daemon/` — runtime state (lock, port block). Not source.
- **The dev environment**
  - The `web` service is `pnpm dev` (vite + workerd), healthchecked on its
    log line. Live URL comes from `hangar services` (currently
    `https://web.rvkfoodie.localhost:22024`); the port is per-workspace and
    survives restarts.
  - The daemon owns the port and hands it to vite as `$PORT` — read `$PORT`,
    never hardcode 3000 (see `vite.config.ts`).
  - Secrets come from `.dev.vars` (gitignored) via wrangler. Fresh worktrees
    won't have it — don't assume auth secrets exist there.
- **What you can do**
  - `hangar services` — what's running and healthy (also `--json`).
  - `hangar requests` — every HTTP request the proxy carried: proof of what
    the app actually served.
  - `hangar grep <pattern>` / `hangar proc <name> tail` — service logs.
  - `hangar run` / `hangar watch` — checks + receipts; `hangar status` /
    `hangar log` to read them.
  - `hangar mcp` — the same instruments over MCP; declared `[actions.*]`
    become tools automatically.
- **Rules that bite**
  - Receipts need a clean, stable tree. If the tree is dirty — or anything
    edits files mid-run (another agent included) — `hangar run` mints
    nothing and says why. Settle the tree first.
  - One `hangar run` per worktree at a time; quiet-triggered and manual runs
    can't overlap.
  - hangar never deploys, commits, or pushes — git stays with you.

