-- Align live D1 schema with agent-cms 0000_genesis.sql
-- Adds columns and tables introduced after initial migration

-- assets: audit trail columns
ALTER TABLE "assets" ADD COLUMN "updated_at" text;
ALTER TABLE "assets" ADD COLUMN "created_by" text;
ALTER TABLE "assets" ADD COLUMN "updated_by" text;

-- record_versions: action tracking
ALTER TABLE "record_versions" ADD COLUMN "action" text NOT NULL DEFAULT 'publish';
ALTER TABLE "record_versions" ADD COLUMN "actor_type" text;
ALTER TABLE "record_versions" ADD COLUMN "actor_label" text;
ALTER TABLE "record_versions" ADD COLUMN "actor_token_id" text;

CREATE INDEX IF NOT EXISTS "idx_record_versions_lookup"
  ON "record_versions" ("model_api_key", "record_id", "version_number" DESC);

-- editor_tokens: API token management
CREATE TABLE IF NOT EXISTS "editor_tokens" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "token_prefix" TEXT NOT NULL,
  "secret_hash" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "last_used_at" TEXT,
  "expires_at" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_editor_tokens_secret_hash"
  ON "editor_tokens" ("secret_hash");
