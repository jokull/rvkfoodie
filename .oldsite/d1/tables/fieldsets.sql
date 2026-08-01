PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE `fieldsets` (
	`id` text PRIMARY KEY,
	`model_id` text NOT NULL,
	`title` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_fieldsets_model_id_models_id_fk` FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON DELETE CASCADE
);
