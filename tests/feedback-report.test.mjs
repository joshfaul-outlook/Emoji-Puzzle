import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  buildFeedbackReportQueries,
  getFeedbackReport,
  parseFeedbackReportFilters,
} from "../lib/feedback-report.ts";
import { isFeedbackReviewer } from "../lib/feedback-review-auth.ts";

const CREATE_TABLE = `CREATE TABLE puzzle_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  puzzle_id TEXT NOT NULL,
  puzzle_number INTEGER NOT NULL,
  rating TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  play_id TEXT NOT NULL,
  anonymous_session_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  guess_count INTEGER NOT NULL,
  hint_count INTEGER NOT NULL,
  metadata_json TEXT NOT NULL
)`;

test("validates and bounds feedback report filters", () => {
  assert.deepEqual(parseFeedbackReportFilters({}, 100), { days: 30, puzzleNumber: null });
  assert.deepEqual(parseFeedbackReportFilters({ days: "7", puzzle: "2" }, 100), {
    days: 7,
    puzzleNumber: 2,
  });
  assert.deepEqual(parseFeedbackReportFilters({ days: "999", puzzle: "101" }, 100), {
    days: 365,
    puzzleNumber: null,
  });
  assert.deepEqual(parseFeedbackReportFilters({ days: "nope", puzzle: "-2" }, 100), {
    days: 30,
    puzzleNumber: null,
  });
});

test("keeps every report query read-only and excludes anonymous identifiers and metadata", () => {
  const queries = buildFeedbackReportQueries(
    { days: 30, puzzleNumber: 2 },
    new Date("2026-08-06T12:00:00Z"),
  );
  for (const query of Object.values(queries)) {
    assert.match(query.sql.trim(), /^SELECT\b/i);
    assert.doesNotMatch(query.sql, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE)\b/i);
    assert.doesNotMatch(query.sql, /play_id|anonymous_session_id|metadata_json/i);
  }
});

test("calculates fixed aggregate fixtures and returns only negative or written feedback", async () => {
  await withFixtureDatabase(async (db) => {
    await seedFeedback(db);
    const report = await getFeedbackReport(
      db,
      { days: 30, puzzleNumber: null },
      new Date("2026-08-06T12:00:00Z"),
    );

    assert.deepEqual(report.summary, {
      submissionCount: 3,
      positivePercentage: 66.7,
      solvedPercentage: 66.7,
      averageGuesses: 3,
      averageHints: 1,
    });
    assert.deepEqual(report.puzzles, [
      {
        puzzleId: "rain-cats-dogs",
        puzzleNumber: 1,
        submissionCount: 2,
        positivePercentage: 50,
        solvedPercentage: 50,
        averageGuesses: 3,
        averageHints: 1.5,
      },
      {
        puzzleId: "elephant-room",
        puzzleNumber: 2,
        submissionCount: 1,
        positivePercentage: 100,
        solvedPercentage: 100,
        averageGuesses: 3,
        averageHints: 0,
      },
    ]);
    assert.deepEqual(
      report.recentFeedback.map(({ rating, comment }) => ({ rating, comment })),
      [
        { rating: "down", comment: "The ending felt ambiguous." },
        { rating: "up", comment: "Great reveal." },
      ],
    );
  });
});

test("applies the same puzzle filter to summary, breakdown, and feedback", async () => {
  await withFixtureDatabase(async (db) => {
    await seedFeedback(db);
    const report = await getFeedbackReport(
      db,
      { days: 30, puzzleNumber: 1 },
      new Date("2026-08-06T12:00:00Z"),
    );

    assert.equal(report.summary.submissionCount, 2);
    assert.deepEqual(report.puzzles.map((row) => row.puzzleNumber), [1]);
    assert.equal(report.recentFeedback.length, 1);
    assert.equal(report.recentFeedback[0].puzzleNumber, 1);
  });
});

test("returns a safe empty report before the feedback table exists", async () => {
  await withFixtureDatabase(async (db) => {
    const report = await getFeedbackReport(
      db,
      { days: 30, puzzleNumber: null },
      new Date("2026-08-06T12:00:00Z"),
    );
    assert.deepEqual(report.summary, {
      submissionCount: 0,
      positivePercentage: null,
      solvedPercentage: null,
      averageGuesses: null,
      averageHints: null,
    });
    assert.deepEqual(report.puzzles, []);
    assert.deepEqual(report.recentFeedback, []);
  });
});

test("authorizes only the owner's email, case-insensitively", () => {
  assert.equal(isFeedbackReviewer("Josh.Faul@Outlook.com"), true);
  assert.equal(isFeedbackReviewer("visitor@example.com"), false);
  assert.equal(isFeedbackReviewer(""), false);
});

async function withFixtureDatabase(callback) {
  const sqlite = new DatabaseSync(":memory:");
  try {
    await callback(new SqliteD1Adapter(sqlite), sqlite);
  } finally {
    sqlite.close();
  }
}

async function seedFeedback(db) {
  db.sqlite.exec(CREATE_TABLE);
  const insert = `INSERT INTO puzzle_feedback (
    puzzle_id, puzzle_number, rating, comment, created_at, play_id,
    anonymous_session_id, outcome, guess_count, hint_count, metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const statement = db.sqlite.prepare(insert);
  statement.run("rain-cats-dogs", 1, "up", null, "2026-08-05 12:00:00", "p1", "s1", "solved", 1, 0, "{}");
  statement.run("rain-cats-dogs", 1, "down", "The ending felt ambiguous.", "2026-08-04 12:00:00", "p2", "s2", "revealed", 5, 3, "{}");
  statement.run("elephant-room", 2, "up", "Great reveal.", "2026-08-03 12:00:00", "p3", "s3", "solved", 3, 0, "{}");
  statement.run("elephant-room", 2, "down", "Old feedback.", "2026-06-01 12:00:00", "p4", "s4", "revealed", 9, 3, "{}");
}

class SqliteD1Adapter {
  constructor(sqlite) {
    this.sqlite = sqlite;
  }

  prepare(sql) {
    return new SqliteStatementAdapter(this.sqlite.prepare(sql));
  }
}

class SqliteStatementAdapter {
  constructor(statement, bindings = []) {
    this.statement = statement;
    this.bindings = bindings;
  }

  bind(...bindings) {
    return new SqliteStatementAdapter(this.statement, bindings);
  }

  async all() {
    return { results: this.statement.all(...this.bindings) };
  }
}
