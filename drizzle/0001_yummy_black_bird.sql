CREATE TABLE `account_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`account` text NOT NULL,
	`lane` text NOT NULL,
	`calendar` integer NOT NULL,
	`mail` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_connections_owner_provider_account` ON `account_connections` (`owner`,`provider`,`account`);