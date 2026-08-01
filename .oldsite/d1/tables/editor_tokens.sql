PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "editor_tokens" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "token_prefix" TEXT NOT NULL,
  "secret_hash" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "last_used_at" TEXT,
  "expires_at" TEXT
);
INSERT INTO "editor_tokens" ("id","name","token_prefix","secret_hash","created_at","last_used_at","expires_at") VALUES('etid_355bfaaf-7c51-4c10-b8ac-33294c931be9','Sunna','etk_130k690k','6b6a9ef60a309fa2d3c81352cdad42177ba19392a932608707ff8053f5d904d6','2026-03-22T19:48:33.925Z',NULL,'2027-03-22T19:48:33.925Z');
INSERT INTO "editor_tokens" ("id","name","token_prefix","secret_hash","created_at","last_used_at","expires_at") VALUES('etid_3dc5f0ad-20d2-4d41-8bfe-b7356ad3510b','Sunna','etk_3s1w5n5l','34fb91b924117aab5704db992623f8a6078d723d2a24a5592f8bac30758d9611','2026-03-22T19:48:33.927Z',NULL,'2027-03-22T19:48:33.927Z');
INSERT INTO "editor_tokens" ("id","name","token_prefix","secret_hash","created_at","last_used_at","expires_at") VALUES('etid_6a8e8546-6db8-4df7-a804-d6407a13551f','Sunna','etk_2u6j092a','6c5a684dbd6c35b52323d036845bcf69486b07f3e1b95dffacc334286ec8acc6','2026-03-23T16:35:20.179Z',NULL,'2027-03-23T16:35:20.179Z');
INSERT INTO "editor_tokens" ("id","name","token_prefix","secret_hash","created_at","last_used_at","expires_at") VALUES('etid_71e41655-4c06-4ea4-a87e-3a434ce53b05','Sunna','etk_0s5f1c69','a5946d828bbf5cd3c33f2f6be502c2f7ca2411334451e9eeb5b596fa1121f1f1','2026-03-23T16:35:20.353Z',NULL,'2027-03-23T16:35:20.353Z');
INSERT INTO "editor_tokens" ("id","name","token_prefix","secret_hash","created_at","last_used_at","expires_at") VALUES('etid_e8b998aa-9d36-4617-a2dc-13f1d4280c67','Sunna','etk_09471z09','38b4f8f9d6b21f2958b09cae488fe79087690509c4f52827d6c064d0407eab50','2026-03-23T16:36:55.486Z','2026-07-26T15:08:26.555Z','2027-03-23T16:36:55.486Z');
INSERT INTO "editor_tokens" ("id","name","token_prefix","secret_hash","created_at","last_used_at","expires_at") VALUES('etid_67388504-dc4b-4b53-aa82-48f6b1964253','Sunna','etk_402x0f4i','b55cde6f3b7f0ec88e433fd9889b23e6d195d8094a6d1fe99ae73d5c2abeb1de','2026-03-23T21:24:03.705Z','2026-07-22T03:39:24.777Z','2027-03-23T21:24:03.705Z');
