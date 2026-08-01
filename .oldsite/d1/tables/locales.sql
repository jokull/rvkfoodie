PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE `locales` (
	`id` text PRIMARY KEY,
	`code` text NOT NULL UNIQUE,
	`position` integer DEFAULT 0 NOT NULL,
	`fallback_locale_id` text,
	CONSTRAINT `fk_locales_fallback_locale_id_locales_id_fk` FOREIGN KEY (`fallback_locale_id`) REFERENCES `locales`(`id`) ON DELETE SET NULL
);
