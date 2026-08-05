import { env } from "cloudflare:workers";

export type FeedbackRecord = {
  puzzleId: string;
  puzzleNumber: number;
  rating: "up" | "down";
  comment: string | null;
  playId: string;
  anonymousSessionId: string;
  outcome: "solved" | "revealed";
  guessCount: number;
  hintCount: number;
  metadataJson: string;
};

const CREATE_FEEDBACK_TABLE = `
  CREATE TABLE IF NOT EXISTS puzzle_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    puzzle_id TEXT NOT NULL,
    puzzle_number INTEGER NOT NULL,
    rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    play_id TEXT NOT NULL,
    anonymous_session_id TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('solved', 'revealed')),
    guess_count INTEGER NOT NULL,
    hint_count INTEGER NOT NULL,
    metadata_json TEXT NOT NULL
  )
`;

export async function insertFeedback(record: FeedbackRecord) {
  if (!env.DB) throw new Error("Feedback database is unavailable");
  await env.DB.prepare(CREATE_FEEDBACK_TABLE).run();
  await env.DB.prepare(
    `INSERT INTO puzzle_feedback (
      puzzle_id, puzzle_number, rating, comment, play_id,
      anonymous_session_id, outcome, guess_count,
      hint_count, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      record.puzzleId,
      record.puzzleNumber,
      record.rating,
      record.comment,
      record.playId,
      record.anonymousSessionId,
      record.outcome,
      record.guessCount,
      record.hintCount,
      record.metadataJson,
    )
    .run();
}
