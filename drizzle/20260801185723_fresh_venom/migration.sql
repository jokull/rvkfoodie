CREATE TABLE `venue_awards` (
	`id` text PRIMARY KEY,
	`venue_id` text NOT NULL,
	`award_type` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_venue_awards_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE CASCADE,
	CONSTRAINT `venue_awards_venue_type` UNIQUE(`venue_id`,`award_type`)
);
