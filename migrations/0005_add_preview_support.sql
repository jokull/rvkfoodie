-- Add preview token support and canonical path templates

ALTER TABLE models ADD COLUMN "canonical_path_template" TEXT;

CREATE TABLE IF NOT EXISTS "preview_tokens" (
  "id" TEXT PRIMARY KEY,
  "token_hash" TEXT NOT NULL UNIQUE,
  "expires_at" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_preview_tokens_hash"
  ON "preview_tokens" ("token_hash");
