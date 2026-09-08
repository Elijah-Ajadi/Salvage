CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`photo` text NOT NULL,
	`category` text NOT NULL,
	`material` text NOT NULL,
	`condition` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`address` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`posted_by` text NOT NULL,
	`claimed_by` text,
	`created_at` integer NOT NULL,
	`nonprofit` text,
	`estimated_value` real,
	`donated_at` integer,
	FOREIGN KEY (`posted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`claimed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_listings_status_created` ON `listings` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_listings_posted_by` ON `listings` (`posted_by`);--> statement-breakpoint
CREATE INDEX `idx_listings_claimed_by` ON `listings` (`claimed_by`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_created` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`address` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`radius` integer NOT NULL,
	`preferences` text NOT NULL
);
