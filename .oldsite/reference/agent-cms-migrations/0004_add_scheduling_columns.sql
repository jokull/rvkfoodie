-- Add scheduling columns to all content tables
-- These columns were added to agent-cms's DDL but existing tables need them

ALTER TABLE "content_about_page" ADD COLUMN "_scheduled_publish_at" TEXT;
ALTER TABLE "content_about_page" ADD COLUMN "_scheduled_unpublish_at" TEXT;

ALTER TABLE "content_changelog_entry" ADD COLUMN "_scheduled_publish_at" TEXT;
ALTER TABLE "content_changelog_entry" ADD COLUMN "_scheduled_unpublish_at" TEXT;

ALTER TABLE "content_editorial" ADD COLUMN "_scheduled_publish_at" TEXT;
ALTER TABLE "content_editorial" ADD COLUMN "_scheduled_unpublish_at" TEXT;

ALTER TABLE "content_guide" ADD COLUMN "_scheduled_publish_at" TEXT;
ALTER TABLE "content_guide" ADD COLUMN "_scheduled_unpublish_at" TEXT;

ALTER TABLE "content_home_page" ADD COLUMN "_scheduled_publish_at" TEXT;
ALTER TABLE "content_home_page" ADD COLUMN "_scheduled_unpublish_at" TEXT;

ALTER TABLE "content_site_settings" ADD COLUMN "_scheduled_publish_at" TEXT;
ALTER TABLE "content_site_settings" ADD COLUMN "_scheduled_unpublish_at" TEXT;
