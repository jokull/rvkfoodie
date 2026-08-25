-- Demo guide for production — Hotel Borg (guide_01, slug "hotel-borg").
-- This is the LIVE sample a sales prospect / hotel guest sees, so the /g page
-- is never a dead end in prod. Idempotent (INSERT OR IGNORE). Timestamps are
-- epoch ms. JSON list columns (tags, recommended_dishes, photos) hold JSON
-- text. Deliberately scoped to ONLY what the hotel-borg guide needs — it does
-- NOT touch the CRM tables (businesses/contacts/deals), which stay empty until
-- real data lands.

INSERT OR IGNORE INTO venues (id, name, category, category_secondary, status, order_key, cuisine, price_level, tags, note, recommended_dishes, last_verified_at, confidence, source, address, lat, lon, google_places_id, dineout_id, opening_hours, photos, created_at, updated_at) VALUES
('venue_01', 'Svarta Kaffið', 'cafe', NULL, 'live', 'a0', 'soup, sandwiches', 2, '["legendary","lunch"]', 'The famous bread-bowl soup. A Reykjavík institution.', '["bread bowl soup","lamb soup"]', 1750000000000, 0.9, 'backfill', 'Laugavegur 54', 64.1455, -21.9231, NULL, NULL, 'Mo-Su 10:00-22:00', '[]', 1719792000000, 1719792000000),
('venue_02', 'Bæjarins Beztu Pylsur', 'street-food', NULL, 'live', 'a1', 'hot dogs', 1, '["famous","quick"]', 'The famous hot dog stand near the harbour. Go for the eina með öllu.', '["hot dog with everything"]', 1750000000000, 0.95, 'backfill', 'Tryggvagata 1', 64.148, -21.9412, NULL, NULL, 'Mo-Su 10:00-01:00', '[]', 1719792000000, 1719792000000),
('venue_03', 'Dill', 'restaurant', NULL, 'live', 'a2', 'new nordic', 4, '["michelin","tasting menu"]', 'Michelin-starred New Nordic tasting menu. Book ahead.', '["tasting menu"]', 1750000000000, 0.95, 'backfill', 'Laugavegur 59', 64.1447, -21.9274, NULL, NULL, 'Tu-Sa 18:00-23:00', '[]', 1719792000000, 1719792000000),
('venue_05', 'Fiskmarkaðurinn', 'restaurant', NULL, 'live', 'a4', 'seafood', 4, '["seafood","upscale"]', 'Seafood market restaurant downtown. Creative Icelandic fish.', '["lobster","saltfish"]', 1747000000000, 0.85, 'backfill', 'Aðalstræti 12', 64.1472, -21.9405, NULL, NULL, 'Mo-Sa 11:30-14:30, 18:00-23:00', '[]', 1719792000000, 1719792000000),
('venue_06', 'The Laundromat Cafe', 'cafe', 'breakfast-brunch', 'live', 'a5', 'brunch, pancakes', 2, '["brunch","family"]', 'Pancakes, weekend brunch, and a basement play area for kids.', '["pancakes","weekend brunch"]', 1747000000000, 0.8, 'backfill', 'Austurstræti 9', 64.1474, -21.9387, NULL, NULL, 'Mo-Su 08:00-23:00', '[]', 1719792000000, 1719792000000),
('venue_07', 'Café Loki', 'cafe', NULL, 'live', 'a6', 'icelandic classics', 2, '["hallgrimskirkja","traditional"]', 'Icelandic classics near Hallgrímskirkja. Good view of the church.', '["rye bread ice cream","fish stew"]', 1747000000000, 0.9, 'backfill', 'Lokastígur 28', 64.1441, -21.9269, NULL, NULL, 'Mo-Su 09:00-21:00', '[]', 1719792000000, 1719792000000),
('venue_08', 'Kol', 'restaurant', 'bar', 'live', 'a7', 'bistro', 4, '["tasting menu","cocktails"]', 'Bistro with a tasting menu and a serious cocktail list.', '["tasting menu","bistro classics"]', 1747000000000, 0.85, 'backfill', 'Skólavörðustígur 40', 64.145, -21.9305, NULL, NULL, 'Mo-Su 11:30-15:00, 17:30-23:00', '[]', 1719792000000, 1719792000000);

INSERT OR IGNORE INTO hotels (id, business_id, name, address, lat, lon, room_count, website, notes, created_at, updated_at) VALUES
('hotel_01', NULL, 'Hotel Borg', 'Pósthússtræti 11', 64.1471, -21.9369, 58, 'https://www.keahotels.is', 'Boutique classic, Austurvöllur', 1719792000000, 1719792000000);

INSERT OR IGNORE INTO guides (id, hotel_id, slug, status, radius_min, target_count, generated_at, created_at, updated_at) VALUES
('guide_01', 'hotel_01', 'hotel-borg', 'live', 20, 24, 1750000000000, 1719792000000, 1719792000000);

INSERT OR IGNORE INTO guide_venues (id, guide_id, venue_id, status, order_key, override_text, pinned, created_at, updated_at) VALUES
('gv_01', 'guide_01', 'venue_01', 'live', 'a0', NULL, 0, 1719792000000, 1719792000000),
('gv_02', 'guide_01', 'venue_02', 'live', 'a1', NULL, 0, 1719792000000, 1719792000000),
('gv_03', 'guide_01', 'venue_03', 'live', 'a2', NULL, 0, 1719792000000, 1719792000000),
('gv_04', 'guide_01', 'venue_05', 'live', 'a3', NULL, 0, 1719792000000, 1719792000000),
('gv_05', 'guide_01', 'venue_06', 'live', 'a4', NULL, 0, 1719792000000, 1719792000000),
('gv_06', 'guide_01', 'venue_07', 'live', 'a5', NULL, 0, 1719792000000, 1719792000000),
('gv_07', 'guide_01', 'venue_08', 'live', 'a6', NULL, 0, 1719792000000, 1719792000000);
