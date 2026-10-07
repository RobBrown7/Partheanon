CREATE TABLE `commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`project` text NOT NULL,
	`lane` text NOT NULL,
	`stakeholder` text NOT NULL,
	`deadline` text NOT NULL,
	`minutes` integer NOT NULL,
	`status` text NOT NULL,
	`output` text NOT NULL,
	`source_url` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `focus_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `preferences` (
	`owner` text PRIMARY KEY NOT NULL,
	`start_hour` integer NOT NULL,
	`end_hour` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_snapshots` (
	`owner` text NOT NULL,
	`source` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `source`)
);
