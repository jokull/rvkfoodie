# Agent-CMS Friction Log

Issues and friction points encountered while migrating rvkfoodie.is to agent-cms.

## Search indexing not working after content creation

**Problem:** Records created before Vectorize/AI bindings were added are not indexed. FTS tables aren't auto-created when the model is created (silenced by `Effect.ignore`). Re-publishing records doesn't trigger re-indexing.

**Root cause:** `Effect.ignore` on `SearchService.createFtsTable()` and `SearchService.indexRecord()` swallows all errors silently. When bindings aren't available, nothing is indexed and no error is visible.

**Needed:** A `/api/search/reindex` endpoint (or MCP tool) that rebuilds all FTS and Vectorize indexes from scratch. Also: surface search indexing errors in logs instead of silencing them.

**Workaround:** Manually created FTS tables via `wrangler d1 execute`, then PATCH'd each record to trigger re-indexing.

## FTS table schema mismatch

**Problem:** The `createFtsTable` function creates tables with `(record_id UNINDEXED, title, body)` but when manually creating via D1 CLI, I used `(record_id UNINDEXED, model_api_key UNINDEXED, title, body)` which silently broke all search queries.

**Needed:** Documentation of the exact FTS5 schema, or better: a `PRAGMA table_info()` check before creating.

## Nested StructuredText blocks resolver errors

**Problem:** Before the recursive typed blocks fix, querying `SectionRecord.venues { blocks { ... on VenueRecord } }` returned INTERNAL_SERVER_ERROR. The error was not informative.

**Resolution:** Fixed in commit `54b4fc1` — recursive typed block resolution.

## GraphQL pluralization

**Problem:** `changelog_entry` model generates `allChangelogEntrys` (not `allChangelogEntries`). Automatic pluralization doesn't handle irregular English plurals.

**Impact:** Minor — just need to know the exact query name. Could be documented or use a consistent `allXList` pattern.

## Asset URL mismatch with R2

**Problem:** GraphQL returns asset URLs like `https://media.rvkfoodie.is/assets/{id}/{filename}` but R2 bucket stores files at root: `https://media.rvkfoodie.is/{filename}`. The `/assets/{id}/` path prefix doesn't exist in R2.

**Workaround:** Extract filename from the URL and construct `media.rvkfoodie.is/{filename}` directly.

**Needed:** `ASSET_BASE_URL` should produce URLs that match the actual R2 path structure, or the asset serving route should handle the redirect.

## gql.tada fragment readFragment not working at runtime

**Problem:** Using `readFragment()` with gql.tada fragments caused 500 errors at runtime in Cloudflare Workers. Likely due to symbol/metadata stripping during bundling.

**Workaround:** Use inline queries without `readFragment()`. Types still work via `ResultOf<>` inference.

**Needed:** Test gql.tada fragment colocation in Workers runtime. May need `graphql()` tag to embed fragment text inline.

## No admin UI / dashboard

**Problem:** No way to visually verify content, edit records, or browse the schema without writing API calls or GraphQL queries.

**Accepted tradeoff:** Agent-first design. MCP tools and GraphQL playground at `/graphql` are the primary interfaces.

## GraphQL depth limit blocks introspection

**Problem:** Default query depth limit (12) blocks the standard GraphQL introspection query used by gql.tada `generate-schema`. Returns "Query depth 18 exceeds limit 12".

**Impact:** Cannot regenerate typed schema after CMS updates. gql.tada, GraphiQL, and other tooling that rely on introspection break.

**Needed:** Either exempt introspection queries from the depth limit, or provide a `/graphql/sdl` endpoint that returns the SDL directly. Also a shallower introspection query that still returns a valid schema doesn't work either — `buildClientSchema` needs `interfaces` which requires deeper nesting.

**Workaround:** Use the previously generated schema file and don't regenerate. Types may drift from actual schema.

## Typed block resolution regression

**Problem:** After latest agent-cms updates (`1067af6` and related commits), querying `content { blocks { __typename ... on SectionRecord { ... } } }` returns "Unexpected error" INTERNAL_SERVER_ERROR. Simple queries without typed blocks still work.

**Impact:** Site is down (500) because all guide page queries use typed blocks. Homepage, about, settings, editorials work fine since they don't use typed block resolution.

**Needed:** Fix the typed block resolver in the latest agent-cms version. The `54b4fc1` recursive fix worked before but something in the subsequent commits (`1067af6`, `adc3211`, `d9d4981`, `9e6340b`, `2bcdd7d`) broke it.

## PATCH endpoint validation

**Problem:** After the "Eliminate any types" commit, PATCH `/api/records/{id}` requires `{ modelApiKey, data: { field: value } }` in the body. Previous format with `modelApiKey` in query params and flat data object stopped working.

**Impact:** Migration scripts needed updating. Error messages ("Struct Encoded side transformation failure") are not user-friendly.
