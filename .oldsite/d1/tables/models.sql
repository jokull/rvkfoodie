PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE `models` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`api_key` text NOT NULL UNIQUE,
	`is_block` integer DEFAULT false NOT NULL,
	`singleton` integer DEFAULT false NOT NULL,
	`sortable` integer DEFAULT false NOT NULL,
	`tree` integer DEFAULT false NOT NULL,
	`has_draft` integer DEFAULT true NOT NULL,
	`ordering` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
, "all_locales_required" integer DEFAULT 0 NOT NULL, "canonical_path_template" TEXT);
INSERT INTO "models" ("id","name","api_key","is_block","singleton","sortable","tree","has_draft","ordering","created_at","updated_at","all_locales_required","canonical_path_template") VALUES('ywy3246jqc','Venue','venue',1,0,0,0,1,NULL,'2026-03-21T18:08:07.608Z','2026-03-21T18:08:07.608Z',0,NULL);
INSERT INTO "models" ("id","name","api_key","is_block","singleton","sortable","tree","has_draft","ordering","created_at","updated_at","all_locales_required","canonical_path_template") VALUES('a08azvgg7d','Section','section',1,0,0,0,1,NULL,'2026-03-21T18:08:07.682Z','2026-03-21T18:08:07.682Z',0,NULL);
INSERT INTO "models" ("id","name","api_key","is_block","singleton","sortable","tree","has_draft","ordering","created_at","updated_at","all_locales_required","canonical_path_template") VALUES('i5akl0rnf5','Text Block','text_block',1,0,0,0,1,NULL,'2026-03-21T18:08:07.753Z','2026-03-21T18:08:07.753Z',0,NULL);
INSERT INTO "models" ("id","name","api_key","is_block","singleton","sortable","tree","has_draft","ordering","created_at","updated_at","all_locales_required","canonical_path_template") VALUES('fvy6zjfg9b','Guide','guide',0,0,0,0,1,NULL,'2026-03-21T18:08:07.822Z','2026-03-23T16:28:15.205Z',0,'/guides/{slug}');
INSERT INTO "models" ("id","name","api_key","is_block","singleton","sortable","tree","has_draft","ordering","created_at","updated_at","all_locales_required","canonical_path_template") VALUES('6neykig9bm','Editorial','editorial',0,0,0,0,1,NULL,'2026-03-21T18:08:07.889Z','2026-03-23T16:27:46.099Z',0,'/blog/{slug}');
INSERT INTO "models" ("id","name","api_key","is_block","singleton","sortable","tree","has_draft","ordering","created_at","updated_at","all_locales_required","canonical_path_template") VALUES('o9i3p17bqn','Changelog Entry','changelog_entry',0,0,1,0,1,NULL,'2026-03-21T18:08:07.957Z','2026-03-21T18:08:07.957Z',0,NULL);
INSERT INTO "models" ("id","name","api_key","is_block","singleton","sortable","tree","has_draft","ordering","created_at","updated_at","all_locales_required","canonical_path_template") VALUES('88hku3r9hh','Home Page','home_page',0,1,0,0,0,NULL,'2026-03-21T18:08:08.031Z','2026-03-23T16:27:47.010Z',0,'/');
INSERT INTO "models" ("id","name","api_key","is_block","singleton","sortable","tree","has_draft","ordering","created_at","updated_at","all_locales_required","canonical_path_template") VALUES('tktxepda7a','About Page','about_page',0,1,0,0,0,NULL,'2026-03-21T18:08:08.109Z','2026-03-23T16:27:46.522Z',0,'/about');
INSERT INTO "models" ("id","name","api_key","is_block","singleton","sortable","tree","has_draft","ordering","created_at","updated_at","all_locales_required","canonical_path_template") VALUES('4ma8stbjgm','Site Settings','site_settings',0,1,0,0,0,NULL,'2026-03-21T18:08:08.187Z','2026-03-21T18:08:08.187Z',0,NULL);
INSERT INTO "models" ("id","name","api_key","is_block","singleton","sortable","tree","has_draft","ordering","created_at","updated_at","all_locales_required","canonical_path_template") VALUES('00w1y7vjqd','Image','image_block',1,0,0,0,1,NULL,'2026-03-21T18:08:08.262Z','2026-03-21T18:08:08.262Z',0,NULL);
