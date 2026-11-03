CREATE TABLE `focus_calendars` (
	`owner` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`account` text NOT NULL,
	`calendar_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`key_digest` text,
	`key_expires_at` text,
	`lease_command` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `focus_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`calendar_config_id` text NOT NULL,
	`block_id` text NOT NULL,
	`task_id` text NOT NULL,
	`event_id` text NOT NULL,
	`operation` text NOT NULL,
	`title` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`baseline_start` text NOT NULL,
	`baseline_end` text NOT NULL,
	`expected_etag` text,
	`state` text NOT NULL,
	`claim_token` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`receipt` text,
	`error` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`confirmed_at` text
);
