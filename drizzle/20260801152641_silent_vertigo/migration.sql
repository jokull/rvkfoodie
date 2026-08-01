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
CREATE TABLE `venues` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`category` text NOT NULL,
	`neighborhood` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hotels_pipeline_idx` ON `hotels` (`pipeline_stage`);--> statement-breakpoint
CREATE INDEX `venues_status_idx` ON `venues` (`status`);