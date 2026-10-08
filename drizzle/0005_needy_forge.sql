CREATE TABLE `chat_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`action` text NOT NULL,
	`payload` text NOT NULL,
	`baseline` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
