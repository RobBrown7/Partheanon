ALTER TABLE `commitments` ADD `delay_impact` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `commitments` ADD `people_blocked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `commitments` ADD `delay_consequence` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `preferences` ADD `focus_task_id` text;