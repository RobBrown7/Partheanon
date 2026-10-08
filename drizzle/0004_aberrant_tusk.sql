CREATE TABLE `work_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`task_id` text NOT NULL,
	`worked_on` text NOT NULL,
	`minutes` integer NOT NULL,
	`ai_minutes` integer NOT NULL,
	`skills` text NOT NULL,
	`notes` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `commitments` ADD `parent_id` text;