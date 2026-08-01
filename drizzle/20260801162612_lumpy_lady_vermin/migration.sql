CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before` text,
	`after` text,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hotels` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`room_count` integer DEFAULT 0 NOT NULL,
	`website` text,
	`pipeline_stage` text DEFAULT 'prospect' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `venue_lifecycle_events` (
	`id` text PRIMARY KEY,
	`venue_id` text NOT NULL,
	`type` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`category` text NOT NULL,
	`category_secondary` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`order_key` text NOT NULL,
	`cuisine` text,
	`price_level` integer,
	`tags` text NOT NULL,
	`note` text,
	`recommended_dishes` text NOT NULL,
	`last_verified_at` integer,
	`confidence` real DEFAULT 0 NOT NULL,
	`source` text,
	`address` text NOT NULL,
	`lat` real,
	`lon` real,
	`google_places_id` text,
	`dineout_id` text,
	`opening_hours` text,
	`photos` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_at_idx` ON `audit_log` (`at`);--> statement-breakpoint
CREATE INDEX `hotels_pipeline_idx` ON `hotels` (`pipeline_stage`);--> statement-breakpoint
CREATE INDEX `vle_venue_idx` ON `venue_lifecycle_events` (`venue_id`);--> statement-breakpoint
CREATE INDEX `vle_type_idx` ON `venue_lifecycle_events` (`type`);--> statement-breakpoint
CREATE INDEX `venues_status_idx` ON `venues` (`status`);--> statement-breakpoint
CREATE INDEX `venues_category_idx` ON `venues` (`category`);--> statement-breakpoint
CREATE INDEX `venues_order_idx` ON `venues` (`order_key`);