PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_create_system_tables.sql','2026-03-20 21:24:01');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_align_with_genesis.sql','2026-03-20 21:24:01');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_add_actor_columns.sql','2026-03-20 21:24:01');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'0004_add_scheduling_columns.sql','2026-03-20 21:24:01');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(5,'0005_add_preview_support.sql','2026-03-23 16:26:39');
