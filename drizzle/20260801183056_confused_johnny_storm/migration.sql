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
CREATE TABLE `businesses` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`website` text,
	`industry` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY,
	`business_id` text NOT NULL,
	`hotel_id` text,
	`first_name` text,
	`last_name` text,
	`email` text,
	`phone` text,
	`title` text,
	`is_decision_maker` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`stage` text DEFAULT 'prospect' NOT NULL,
	`price_per_room` integer,
	`annual_value` integer,
	`start_date` integer,
	`renewal_date` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guide_captures` (
	`id` text PRIMARY KEY,
	`guide_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guide_events` (
	`id` text PRIMARY KEY,
	`guide_id` text NOT NULL,
	`event` text NOT NULL,
	`venue_id` text,
	`happened_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guide_excludes` (
	`id` text PRIMARY KEY,
	`guide_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `ge_guide_venue_uq` UNIQUE(`guide_id`,`venue_id`)
);
--> statement-breakpoint
CREATE TABLE `guide_venues` (
	`id` text PRIMARY KEY,
	`guide_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`order_key` text NOT NULL,
	`override_text` text,
	`pinned` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `gv_guide_venue_uq` UNIQUE(`guide_id`,`venue_id`)
);
--> statement-breakpoint
CREATE TABLE `guides` (
	`id` text PRIMARY KEY,
	`hotel_id` text NOT NULL,
	`slug` text NOT NULL UNIQUE,
	`status` text DEFAULT 'draft' NOT NULL,
	`radius_min` integer DEFAULT 20 NOT NULL,
	`target_count` integer DEFAULT 24 NOT NULL,
	`generated_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hotels` (
	`id` text PRIMARY KEY,
	`business_id` text,
	`name` text NOT NULL UNIQUE,
	`address` text,
	`lat` real,
	`lon` real,
	`room_count` integer DEFAULT 0 NOT NULL,
	`website` text,
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
CREATE INDEX `businesses_name_idx` ON `businesses` (`name`);--> statement-breakpoint
CREATE INDEX `contacts_business_idx` ON `contacts` (`business_id`);--> statement-breakpoint
CREATE INDEX `deals_business_idx` ON `deals` (`business_id`);--> statement-breakpoint
CREATE INDEX `deals_stage_idx` ON `deals` (`stage`);--> statement-breakpoint
CREATE INDEX `gc_guide_idx` ON `guide_captures` (`guide_id`);--> statement-breakpoint
CREATE INDEX `ge_guide_idx` ON `guide_events` (`guide_id`);--> statement-breakpoint
CREATE INDEX `ge_event_idx` ON `guide_events` (`event`);--> statement-breakpoint
CREATE INDEX `gv_guide_idx` ON `guide_venues` (`guide_id`);--> statement-breakpoint
CREATE INDEX `gv_venue_idx` ON `guide_venues` (`venue_id`);--> statement-breakpoint
CREATE INDEX `guides_hotel_idx` ON `guides` (`hotel_id`);--> statement-breakpoint
CREATE INDEX `hotels_business_idx` ON `hotels` (`business_id`);--> statement-breakpoint
CREATE INDEX `vle_venue_idx` ON `venue_lifecycle_events` (`venue_id`);--> statement-breakpoint
CREATE INDEX `vle_type_idx` ON `venue_lifecycle_events` (`type`);--> statement-breakpoint
CREATE INDEX `venues_status_idx` ON `venues` (`status`);--> statement-breakpoint
CREATE INDEX `venues_category_idx` ON `venues` (`category`);--> statement-breakpoint
CREATE INDEX `venues_order_idx` ON `venues` (`order_key`);