CREATE TABLE `oauth_accounts` (
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`account` text NOT NULL,
	`sealed` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `provider`, `account`)
);
--> statement-breakpoint
CREATE TABLE `oauth_clients` (
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`sealed` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `provider`)
);
--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`account` text NOT NULL,
	`verifier` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used` integer DEFAULT false NOT NULL
);
