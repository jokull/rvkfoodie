# MCP — agent access to the whole product surface

`wayfinder:task` — depends on: 02-venue-data-model, 03-crm-data-model,
05-guide-model-drafting-engine, 08-r2-photo-uploads, 10-auth-better-auth

## Question

Ship a Model Context Protocol server so an agent (Claude Desktop / Claude
Code / Cursor) can drive the whole product from one endpoint:

- **agent-cms** — wrap the in-process agent-cms MCP so consumer-site content
  (guides, editorials, changelog, site settings, assets) is editable through
  the same connection. Scope: **editor** (`/mcp/editor`) — content, drafts,
  publish, versions, assets — not schema mutation.
- **File uploads** — the R2 media-bucket upload flow behind
  `src/routes/api.upload.ts` as an MCP tool (base64 in, CDN URL out).
- **The rest of the CRM, hotel guides, and venues database** — every
  staff-relevant result-rpc procedure (venues, awards, audit, hotels,
  businesses, contacts, deals, guides, guide venues, stats) as MCP tools,
  reusing the existing handlers (no duplication).

## Decisions (this ticket)

- **Stateless MCP (2026-07-28)** — the new standard (SEP-2575, final):
  no initialize handshake, per-request version in `_meta` +
  `MCP-Protocol-Version` header, `server/discover`. Hand-rolled JSON-RPC over
  HTTP (no new deps — matches agent-cms/result-rpc style; agent-cms itself is
  moving stateless). Legacy streamable-HTTP clients (2024-11-05 / 2025-06-18)
  are accepted: initialize/ping answered sessionless, POST without the
  stateless `_meta` processed directly, GET serves a never-pushing SSE stream.
- **One secret** — `Authorization: Bearer <CMS_WRITE_KEY>` gates the whole
  endpoint (same secret as agent-cms's own MCP). The RPC context carries a
  synthetic staff session; handlers that read `context.session` (digest
  audit) attribute to `mcp@rvkfoodie.is`.
- **Mounted in the same worker** at `/api/mcp` (TanStack server route) — the
  fourth surface: consumer site, /g guides, /app SPA, MCP. D1 + R2 +
  agent-cms are all in-process, so no new bindings.
- **agent-cms proxy** — agent-cms's MCP is Effect-RPC over plain JSON-RPC
  POST (`tools/call` works directly, no initialize). The proxy answers with a
  JSON-RPC batch array even for a single request — the proxy picks the
  message for its id and supports SSE/NDJSON framing defensively. Tools are
  merged into `tools/list` at runtime (60s TTL) so agent-cms schema changes
  flow through.
- **RPC tools dispatch via `createServerClient`** — middleware, input/output
  codecs, and error sanitization run exactly as for the SPA. Paginated
  procedures take `{ list, cursor: string|null }`; the feed tool normalizes a
  bare optional cursor.

## Progress (2026-08-24) — SHIPPED

- `src/mcp.ts` — stateless JSON-RPC engine: server/discover, tools/list,
  tools/call, `_meta` + header validation (-32020/-32022/-32602/-32601),
  `resultType: "complete"`, JSON-RPC batches, legacy initialize/ping + GET
  SSE compat, bearer auth.
- `src/mcp-tools.ts` — 40 RPC-backed tools (venues/awards/audit/hotels/
  businesses/contacts/deals/guides/guideVenues/stats), `upload_venue_photo`
  (R2, mirrors /api/upload), and the agent-cms `/mcp/editor` proxy (21 tools
  merged live — schema_info, create_record, update_record, set_publish_status,
  search_content, asset tools, site settings, preview URLs).
- `src/routes/api.mcp.ts` — TanStack server route, POST/GET /api/mcp.
- `scripts/mcp-e2e.test.ts` (`pnpm test:mcp`) — 31 assertions: auth rejects,
  discover, merged tools/list, RPC reads + mutation + audit trail, upload,
  agent-cms proxy call, version errors, batches, legacy compat. All green
  against `pnpm dev`.
- `pnpm check` clean; MCP.md documents the surface + `claude mcp add`.
- Open item (not built): most rpc-server handlers hardcode the audit actor as
  `system`/`staff`, so MCP-originated writes aren't per-actor attributed in
  the audit log yet — thread `context.session` through handlers when wanted.

## Update (2026-08-24) — agent-cms stateless migration prep

agent-cms is moving its MCP to stateless 2026-07-28 (dropping the Effect MCP
transport; Effect rc.111). The rvkfoodie proxy (`src/mcp-tools.ts`) is now
**stateless-first with a legacy fallback**: it sends `_meta` (protocolVersion
+ clientInfo + clientCapabilities) and the `MCP-Protocol-Version` header, and
on a transport-level failure against the old Effect MCP retries once in the
legacy plain form, caching the working wire mode per isolate. Works against
agent-cms 0.4.5 today and the stateless release with no code change — the
swap is a plain `agent-cms` dep bump. The stateless agent-cms answers single
JSON-RPC objects (no more batch-array workaround needed, but the tolerant
parser stays). e2e green against the hangar-managed dev server (URL resolved
from `hangar services`, `MCP_URL` override).

## Update (2026-08-25) — dev key source moved off .dev.vars

`scripts/mcp-e2e.test.ts` read `CMS_WRITE_KEY` from `.dev.vars`, which the env
rework deleted (secrets now live in the hangar Keychain). The test now reads
`hangar secrets get CMS_WRITE_KEY` (env-var override wins); `MCP.md` updated
to match, and prod connect URL uses `www.rvkfoodie.is` (apex 301s and drops
the bearer header on redirect). `pnpm test:mcp` green — 62 merged tools,
CMS proxy calls working.

Open item unchanged: most rpc-server handlers hardcode the audit actor as
`system`/`staff`; MCP-originated writes aren't per-actor attributed yet.

## Update (2026-08-24) — agent-cms 0.4.6 shipped, stateless live

agent-cms released **0.4.6** (commit 44e2ca9, hand-rolled stateless MCP
2026-07-28, Effect rc.111; npm Trusted Publishing). rvkfoodie bumped
`agent-cms` 0.4.5 → 0.4.6 (`pnpm install`; pnpm added
`agent-cms@0.4.6` to `minimumReleaseAgeExclude` in pnpm-workspace.yaml), the
hangar web service was restarted, and the proxy now runs **stateless mode by
construction** (0.4.6 has no legacy Effect MCP). Verified: `pnpm check`
clean, `pnpm test:mcp` all green (62 merged tools, CMS proxy calls working)
against `http://web.rvkfoodie.localhost:<port>/api/mcp`.
