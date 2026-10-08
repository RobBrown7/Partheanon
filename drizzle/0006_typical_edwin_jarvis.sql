CREATE TABLE `chat_limits` (
	`owner` text PRIMARY KEY NOT NULL,
	`window` text NOT NULL,
	`count` integer NOT NULL
);
