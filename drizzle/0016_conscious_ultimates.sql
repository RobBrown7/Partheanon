CREATE TABLE `ingest_deferred` (
	`owner` text NOT NULL,
	`stream_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`record_id` text NOT NULL,
	`kind` text NOT NULL,
	`reason` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`stream_id`, `batch_id`, `record_id`)
);
--> statement-breakpoint
ALTER TABLE `ingest_receipts` ADD `result` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingest_receipts` ADD `envelope` text;--> statement-breakpoint
ALTER TABLE `ingest_records` ADD `state` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingest_records` ADD `reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingest_records` ADD `evidence_batch` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingest_streams` ADD `contract` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingest_streams` ADD `scope_definition` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingest_streams` ADD `sequence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingest_streams` ADD `review_count` integer DEFAULT 0 NOT NULL;