PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "_cms_migrations" ("version" integer PRIMARY KEY, "applied_at" text NOT NULL DEFAULT (datetime('now')));
INSERT INTO "_cms_migrations" ("version","applied_at") VALUES(1,'2026-03-17 11:58:13');
INSERT INTO "_cms_migrations" ("version","applied_at") VALUES(2,'2026-03-17 11:58:13');
INSERT INTO "_cms_migrations" ("version","applied_at") VALUES(3,'2026-03-17 11:58:14');
INSERT INTO "_cms_migrations" ("version","applied_at") VALUES(4,'2026-03-17 11:58:14');
