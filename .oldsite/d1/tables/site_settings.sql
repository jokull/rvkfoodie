PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "site_settings" (
        "id" text PRIMARY KEY DEFAULT 'default',
        "site_name" text,
        "title_suffix" text,
        "no_index" integer DEFAULT 0 NOT NULL,
        "favicon_id" text,
        "facebook_page_url" text,
        "twitter_account" text,
        "fallback_seo_title" text,
        "fallback_seo_description" text,
        "fallback_seo_image_id" text,
        "fallback_seo_twitter_card" text DEFAULT 'summary',
        "updated_at" text NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "fk_site_settings_favicon" FOREIGN KEY ("favicon_id") REFERENCES "assets"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_site_settings_seo_image" FOREIGN KEY ("fallback_seo_image_id") REFERENCES "assets"("id") ON DELETE SET NULL
      );
INSERT INTO "site_settings" ("id","site_name","title_suffix","no_index","favicon_id","facebook_page_url","twitter_account","fallback_seo_title","fallback_seo_description","fallback_seo_image_id","fallback_seo_twitter_card","updated_at") VALUES('default','RVK Foodie',' — RVK Foodie',0,NULL,NULL,NULL,'RVK Foodie — Reykjavík Food Guides by a Local','Honest, up-to-date food guides for Reykjavík and Iceland — written by a local who eats out constantly. No tourist traps, just the good stuff.',NULL,'summary','2026-03-21 11:07:29');
