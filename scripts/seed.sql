-- Seed venues + hotels for local dev. Idempotent (INSERT OR IGNORE).
-- Timestamps are epoch ms. JSON list columns (tags, recommended_dishes,
-- photos) hold JSON text; confidence is 0..1.

INSERT OR IGNORE INTO venues (id, name, category, category_secondary, status, order_key, cuisine, price_level, tags, note, recommended_dishes, last_verified_at, confidence, source, address, lat, lon, google_places_id, dineout_id, opening_hours, photos, created_at, updated_at) VALUES
('venue_01', 'Svarta Kaffið', 'cafe', NULL, 'live', 'a0', 'soup, sandwiches', 2, '["legendary","lunch"]', 'The famous bread-bowl soup. A Reykjavík institution.', '["bread bowl soup","lamb soup"]', 1750000000000, 0.9, 'backfill', 'Laugavegur 54', 64.1455, -21.9231, NULL, NULL, 'Mo-Su 10:00-22:00', '[]', 1719792000000, 1719792000000),
('venue_02', 'Bæjarins Beztu Pylsur', 'street-food', NULL, 'live', 'a1', 'hot dogs', 1, '["famous","quick"]', 'The famous hot dog stand near the harbour. Go for the eina með öllu.', '["hot dog with everything"]', 1750000000000, 0.95, 'backfill', 'Tryggvagata 1', 64.148, -21.9412, NULL, NULL, 'Mo-Su 10:00-01:00', '[]', 1719792000000, 1719792000000),
('venue_03', 'Dill', 'restaurant', NULL, 'live', 'a2', 'new nordic', 4, '["michelin","tasting menu"]', 'Michelin-starred New Nordic tasting menu. Book ahead.', '["tasting menu"]', 1750000000000, 0.95, 'backfill', 'Laugavegur 59', 64.1447, -21.9274, NULL, NULL, 'Tu-Sa 18:00-23:00', '[]', 1719792000000, 1719792000000),
('venue_04', 'Kaffi Viðey', 'cafe', NULL, 'closed', 'a3', 'coffee, cake', 2, '["island","boat"]', 'Café on Viðey island, reached by boat. Currently closed.', '[]', 1719792000000, 0, 'backfill', 'Viðey', 64.1633, -21.8519, NULL, NULL, NULL, '[]', 1719792000000, 1719792000000),
('venue_05', 'Fiskmarkaðurinn', 'restaurant', NULL, 'live', 'a4', 'seafood', 4, '["seafood","upscale"]', 'Seafood market restaurant downtown. Creative Icelandic fish.', '["lobster","saltfish"]', 1747000000000, 0.85, 'backfill', 'Aðalstræti 12', 64.1472, -21.9405, NULL, NULL, 'Mo-Sa 11:30-14:30, 18:00-23:00', '[]', 1719792000000, 1719792000000),
('venue_06', 'The Laundromat Cafe', 'cafe', 'breakfast-brunch', 'live', 'a5', 'brunch, pancakes', 2, '["brunch","family"]', 'Pancakes, weekend brunch, and a basement play area for kids.', '["pancakes","weekend brunch"]', 1747000000000, 0.8, 'backfill', 'Austurstræti 9', 64.1474, -21.9387, NULL, NULL, 'Mo-Su 08:00-23:00', '[]', 1719792000000, 1719792000000),
('venue_07', 'Café Loki', 'cafe', NULL, 'live', 'a6', 'icelandic classics', 2, '["hallgrimskirkja","traditional"]', 'Icelandic classics near Hallgrímskirkja. Good view of the church.', '["rye bread ice cream","fish stew"]', 1747000000000, 0.9, 'backfill', 'Lokastígur 28', 64.1441, -21.9269, NULL, NULL, 'Mo-Su 09:00-21:00', '[]', 1719792000000, 1719792000000),
('venue_08', 'Kol', 'restaurant', 'bar', 'live', 'a7', 'bistro', 4, '["tasting menu","cocktails"]', 'Bistro with a tasting menu and a serious cocktail list.', '["tasting menu","bistro classics"]', 1747000000000, 0.85, 'backfill', 'Skólavörðustígur 40', 64.145, -21.9305, NULL, NULL, 'Mo-Su 11:30-15:00, 17:30-23:00', '[]', 1719792000000, 1719792000000);

INSERT OR IGNORE INTO hotels (id, name, room_count, website, pipeline_stage, notes, created_at, updated_at) VALUES
('hotel_01', 'Hotel Borg', 58, 'https://www.keahotels.is', 'sample-sent', 'Boutique classic, Austurvöllur', 1719792000000, 1719792000000),
('hotel_02', '101 Hotel', 38, 'https://www.101hotel.is', 'prospect', '', 1719792000000, 1719792000000),
('hotel_03', 'Kex Hostel', 42, 'https://www.kexhostel.is', 'won', 'Design hostel, Grandi', 1719792000000, 1719792000000),
('hotel_04', 'Sand Hotel', 96, 'https://www.sandhotel.is', 'contacted', '', 1719792000000, 1719792000000),
('hotel_05', 'Icelandair Hotel Reykjavík', 103, 'https://www.icelandairhotels.com', 'prospect', '', 1719792000000, 1719792000000);
