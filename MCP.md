# MCP — agent access to the whole product surface

`/api/mcp` is a stateless MCP server (spec 2026-07-28, SEP-2575) on the same
worker, with the same bindings as everything else: agent-cms (editor scope),
the R2 media bucket, and the result-rpc router (venues, CRM, guides). Legacy
streamable-HTTP clients (2024-11-05 / 2025-06-18) are accepted too —
`initialize`/`ping` are answered without sessions and GET serves a
never-pushing SSE stream.

## Auth

Every request needs `Authorization: Bearer <CMS_WRITE_KEY>` — the same secret
that gates agent-cms's own MCP endpoints. In dev the key lives in the macOS
Keychain (`hangar secrets get CMS_WRITE_KEY`); prod via `wrangler secret put`.

## Tool surface (merged at runtime)

- **`venues_*`, `hotels_*`, `businesses_*`, `contacts_*`, `deals_*`,
  `guides_*`, `audit_list`, `stats_overview`** — staff-gated procedures from
  `src/contract.ts`, dispatched in-process through result-rpc's
  `createServerClient` (middleware + codecs + error sanitization run exactly
  as for the SPA). Tool inputs mirror the contract inputs.
- **`upload_venue_photo`** — base64 image → R2 media bucket
  (`venues/{venueId}/{ts}-{name}`), returns the CDN URL. Mirrors
  `src/routes/api.upload.ts`.
- **agent-cms editor tools** (`create_record`, `update_record`,
  `set_publish_status`, `upload_asset`, `search_content`, ...) — proxied live
  from the in-process agent-cms `/mcp/editor` (plain JSON-RPC POST; no
  initialize round-trip). Tool names/schemas flow through verbatim, so
  agent-cms schema changes appear here without a code change. The proxy
  speaks the **stateless** wire (MCP 2026-07-28 — `_meta` version +
  `MCP-Protocol-Version` header) against agent-cms **0.4.6+** (the Effect MCP
  transport is gone); it keeps a one-shot fallback to the legacy plain form
  for older agent-cms, negotiated per isolate.

## Connect

```sh
# dev — hangar owns the port (web service):
#   hangar services   → https://web.rvkfoodie.localhost:<port>
claude mcp add --transport http rvkfoodie http://web.rvkfoodie.localhost:<port>/api/mcp \
  --header "Authorization: Bearer <CMS_WRITE_KEY>"
# plain `pnpm dev` outside hangar: http://localhost:3000/api/mcp

# prod (apex 301s to www — use www so the Authorization header isn't lost):
claude mcp add --transport http rvkfoodie https://www.rvkfoodie.is/api/mcp \
  --header "Authorization: Bearer <prod CMS_WRITE_KEY>"
```

Smoke test against the running dev server: `pnpm test:mcp` (resolves the URL
from `hangar services`, overridable with `MCP_URL`). Read-only checks:
discover/tools/list/reads/version errors; writes one test venue + uploads one
test image to the local D1/R2, like `test:rpc` does.

## Implementation notes

- `src/mcp.ts` — the stateless JSON-RPC engine (discover/list/call,
  `_meta` + `MCP-Protocol-Version` validation, error codes, batches, legacy
  compat). Protocol-only; tools are injected.
- `src/mcp-tools.ts` — the tool registry: RPC-backed tools, the upload tool,
  and the agent-cms editor proxy.
- `src/routes/api.mcp.ts` — the TanStack server route (POST/GET).
- The MCP context carries a synthetic staff session (`mcp@rvkfoodie.is`) —
  handlers that read `context.session` see it (e.g. the digest audit); most
  handlers hardcode `system`/`staff` actors, so MCP writes are not yet
  attributed per-actor in the audit log (open item).
