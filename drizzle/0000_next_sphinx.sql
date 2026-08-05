CREATE TABLE `puzzle_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`puzzle_id` text NOT NULL,
	`puzzle_number` integer NOT NULL,
	`rating` text NOT NULL,
	`comment` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`play_id` text NOT NULL,
	`anonymous_session_id` text NOT NULL,
	`outcome` text NOT NULL,
	`elapsed_seconds` integer NOT NULL,
	`guess_count` integer NOT NULL,
	`hint_count` integer NOT NULL,
	`metadata_json` text NOT NULL
);
