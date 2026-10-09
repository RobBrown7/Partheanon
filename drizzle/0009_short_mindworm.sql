CREATE TABLE `dismissed_emails` (
	`owner` text NOT NULL,
	`email_id` text NOT NULL,
	`dismissed_at` text NOT NULL,
	PRIMARY KEY(`owner`, `email_id`)
);
