-- Add actor tracking columns to all content tables
-- These columns were added to agent-cms's DDL but existing tables need them

ALTER TABLE "content_about_page" ADD COLUMN "_created_by" TEXT;
ALTER TABLE "content_about_page" ADD COLUMN "_updated_by" TEXT;
ALTER TABLE "content_about_page" ADD COLUMN "_published_by" TEXT;

ALTER TABLE "content_changelog_entry" ADD COLUMN "_created_by" TEXT;
ALTER TABLE "content_changelog_entry" ADD COLUMN "_updated_by" TEXT;
ALTER TABLE "content_changelog_entry" ADD COLUMN "_published_by" TEXT;

ALTER TABLE "content_editorial" ADD COLUMN "_created_by" TEXT;
ALTER TABLE "content_editorial" ADD COLUMN "_updated_by" TEXT;
ALTER TABLE "content_editorial" ADD COLUMN "_published_by" TEXT;

ALTER TABLE "content_guide" ADD COLUMN "_created_by" TEXT;
ALTER TABLE "content_guide" ADD COLUMN "_updated_by" TEXT;
ALTER TABLE "content_guide" ADD COLUMN "_published_by" TEXT;

ALTER TABLE "content_home_page" ADD COLUMN "_created_by" TEXT;
ALTER TABLE "content_home_page" ADD COLUMN "_updated_by" TEXT;
ALTER TABLE "content_home_page" ADD COLUMN "_published_by" TEXT;

ALTER TABLE "content_site_settings" ADD COLUMN "_created_by" TEXT;
ALTER TABLE "content_site_settings" ADD COLUMN "_updated_by" TEXT;
ALTER TABLE "content_site_settings" ADD COLUMN "_published_by" TEXT;
