ALTER TABLE `commitments` ADD `life_health_safety` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `commitments` ADD `security_privacy` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `commitments` ADD `important` integer;--> statement-breakpoint
ALTER TABLE `commitments` ADD `depends_on` text DEFAULT '[]' NOT NULL;