import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const puzzleFeedback = sqliteTable("puzzle_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  puzzleId: text("puzzle_id").notNull(),
  puzzleNumber: integer("puzzle_number").notNull(),
  rating: text("rating", { enum: ["up", "down"] }).notNull(),
  comment: text("comment"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  playId: text("play_id").notNull(),
  anonymousSessionId: text("anonymous_session_id").notNull(),
  outcome: text("outcome", { enum: ["solved", "revealed"] }).notNull(),
  guessCount: integer("guess_count").notNull(),
  hintCount: integer("hint_count").notNull(),
  metadataJson: text("metadata_json").notNull(),
});
