PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "preview_tokens" (
  "id" TEXT PRIMARY KEY,
  "token_hash" TEXT NOT NULL UNIQUE,
  "expires_at" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "preview_tokens" ("id","token_hash","expires_at","created_at") VALUES('7yqzysjwz5','6ef23c84699a90b4c10011bc727076d8e3efdc750a3069c98515b75dd9f06262','2026-03-24T16:32:54.403Z','2026-03-23 16:32:54');
INSERT INTO "preview_tokens" ("id","token_hash","expires_at","created_at") VALUES('q6d11k470c','3f56c510083161cb5b4fdd33bc7ae1cd8428939e3e74ba6f7b428ee1bf3b890c','2026-03-23T17:36:37.071Z','2026-03-23 16:36:37');
INSERT INTO "preview_tokens" ("id","token_hash","expires_at","created_at") VALUES('umsn1gfmzs','93aefb043a790df05fb9a3a4651c5943fdae5d415874b8eb041eb151af9542dd','2026-03-24T16:39:03.798Z','2026-03-23 16:39:03');
INSERT INTO "preview_tokens" ("id","token_hash","expires_at","created_at") VALUES('3wicwbx8cg','950b0484373d463cf2ed67974cad9bc5f3c11b10b4bd1829639ca3101124811b','2026-03-24T16:50:43.216Z','2026-03-23 16:50:43');
INSERT INTO "preview_tokens" ("id","token_hash","expires_at","created_at") VALUES('te89b6dveq','27c29ec22e4eba26cc660083593efd237aa9cb27565a7f55c047c53f2e585a32','2026-03-24T17:03:12.534Z','2026-03-23 17:03:12');
INSERT INTO "preview_tokens" ("id","token_hash","expires_at","created_at") VALUES('4skb57lepe','075bf48704d3d1375696db8e9551660e0866f9be303d97acaee6f360a1195e13','2026-03-24T21:42:25.535Z','2026-03-23 21:42:25');
INSERT INTO "preview_tokens" ("id","token_hash","expires_at","created_at") VALUES('lygvku1ise','813fa06f2b9857e20023e7d485510ab66ce5ff1e8308fce33d0a3d29a401e0da','2026-03-24T22:15:11.495Z','2026-03-23 22:15:11');
