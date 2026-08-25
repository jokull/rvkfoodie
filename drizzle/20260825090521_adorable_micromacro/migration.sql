ALTER TABLE `businesses` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `contacts` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `hotels` ADD `deleted_at` integer;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_hotels` (
	`id` text PRIMARY KEY,
	`business_id` text,
	`name` text NOT NULL,
	`address` text,
	`lat` real,
	`lon` real,
	`room_count` integer DEFAULT 0 NOT NULL,
	`website` text,
	`notes` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_hotels`(`id`, `business_id`, `name`, `address`, `lat`, `lon`, `room_count`, `website`, `notes`, `created_at`, `updated_at`) SELECT `id`, `business_id`, `name`, `address`, `lat`, `lon`, `room_count`, `website`, `notes`, `created_at`, `updated_at` FROM `hotels`;--> statement-breakpoint
DROP TABLE `hotels`;--> statement-breakpoint
ALTER TABLE `__new_hotels` RENAME TO `hotels`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `hotels_name_active_uq` ON `hotels` (`name`) WHERE "hotels"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `hotels_business_idx` ON `hotels` (`business_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `businesses_name_active_uq` ON `businesses` (`name`) WHERE "businesses"."deleted_at" is null;