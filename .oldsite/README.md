# .oldsite — legacy archive

Everything from the pre-TanStack-Start era that is still worth keeping, in one
place. The old codebase itself is preserved in git at the `legacy` tag.

## Layout

- `d1/tables/*.sql` — per-table dump (schema + data) of the D1 database
  `rvkfoodie-cms-v4b` at the moment of the rewrite. Exported with
  `wrangler d1 export --table`, because the database contains FTS5 virtual
  tables and a full-database export is refused. Tables live, tracked with
  `d1_migrations`.
- `data/venue-data.json` — a curated venue dataset (Google Maps + OSM +
  corrections) collected for the old site; candidate backfill material.
- `reference/agent-cms-migrations/` — the SQL migrations that built the old
  content schema (content_*, block_*, fts_* tables).
- `reference/README-legacy.md`, `reference/ROADMAP-legacy.md`,
  `reference/MCP-legacy.md` — old project docs for reference.

## Backfill

The old content tables are still live in the D1 database (they were not
dropped), so the new schema can be backfilled from them directly. See the
backfill ticket in `.wayfinder` — when it lands, these tables should be
dropped and this directory trimmed.
