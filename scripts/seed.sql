-- Seed venues + hotels for local dev. Idempotent (INSERT OR IGNORE).
-- Timestamps are epoch milliseconds.

INSERT OR IGNORE INTO venues (id, name, category, neighborhood, status, order_key, notes, created_at, updated_at) VALUES
('venue_01', 'Svarta Kaffið', 'cafe', 'Miðborg', 'live', 'a0', 'Legendary bread bowl soup', 1719792000000, 1719792000000),
('venue_02', 'Bæjarins Beztu Pylsur', 'street-food', 'Miðborg', 'live', 'a1', 'The famous hot dog stand', 1719792000000, 1719792000000),
('venue_03', 'Dill', 'restaurant', 'Laugavegur', 'live', 'a2', 'Michelin-starred New Nordic', 1719792000000, 1719792000000),
('venue_04', 'Kaffi Viðey', 'cafe', 'Viðey', 'closed', 'a3', 'Island cafe, currently closed', 1719792000000, 1719792000000),
('venue_05', 'Fiskmarkaðurinn', 'restaurant', 'Miðborg', 'live', 'a4', 'Seafood market restaurant', 1719792000000, 1719792000000),
('venue_06', 'The Laundromat Cafe', 'cafe', 'Hverfisgata', 'draft', 'a5', 'Pancakes + laundry theme', 1719792000000, 1719792000000),
('venue_07', 'Café Loki', 'cafe', 'Þingholt', 'live', 'a6', 'Icelandic classics near Hallgrímskirkja', 1719792000000, 1719792000000),
('venue_08', 'Kol', 'restaurant', 'Laugavegur', 'live', 'a7', 'Bistro with a tasting menu', 1719792000000, 1719792000000);

INSERT OR IGNORE INTO hotels (id, name, room_count, website, pipeline_stage, notes, created_at, updated_at) VALUES
('hotel_01', 'Hotel Borg', 58, 'https://www.keahotels.is', 'sample-sent', 'Boutique classic, Austurvöllur', 1719792000000, 1719792000000),
('hotel_02', '101 Hotel', 38, 'https://www.101hotel.is', 'prospect', '', 1719792000000, 1719792000000),
('hotel_03', 'Kex Hostel', 42, 'https://www.kexhostel.is', 'won', 'Design hostel, Grandi', 1719792000000, 1719792000000),
('hotel_04', 'Sand Hotel', 96, 'https://www.sandhotel.is', 'contacted', '', 1719792000000, 1719792000000),
('hotel_05', 'Icelandair Hotel Reykjavík', 103, 'https://www.icelandairhotels.com', 'prospect', '', 1719792000000, 1719792000000);
