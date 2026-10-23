CREATE TABLE `ingest_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`digest` text NOT NULL,
	`provider` text NOT NULL,
	`account` text NOT NULL,
	`containers` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked` integer DEFAULT false NOT NULL,
	`rate_window` text DEFAULT '' NOT NULL,
	`rate_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingest_keys_digest` ON `ingest_keys` (`digest`);--> statement-breakpoint
CREATE TABLE `ingest_receipts` (
	`stream_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`digest` text NOT NULL,
	`received_at` text NOT NULL,
	`record_count` integer NOT NULL,
	`deleted_count` integer NOT NULL,
	PRIMARY KEY(`stream_id`, `batch_id`)
);
--> statement-breakpoint
CREATE TABLE `ingest_records` (
	`owner` text NOT NULL,
	`stream_id` text NOT NULL,
	`record_id` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted` integer NOT NULL,
	`payload` text,
	PRIMARY KEY(`stream_id`, `record_id`)
);
--> statement-breakpoint
CREATE TABLE `ingest_streams` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`account` text NOT NULL,
	`resource_type` text NOT NULL,
	`container_id` text NOT NULL,
	`source_key` text NOT NULL,
	`lane` text NOT NULL,
	`test_mode` integer NOT NULL,
	`generation` text DEFAULT '' NOT NULL,
	`generated_at` text DEFAULT '' NOT NULL,
	`received_at` text DEFAULT '' NOT NULL,
	`window_start` text NOT NULL,
	`window_end` text NOT NULL,
	`complete` integer DEFAULT false NOT NULL,
	`published` integer DEFAULT false NOT NULL
);
