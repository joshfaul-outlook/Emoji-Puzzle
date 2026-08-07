import type { PuzzlePool } from "./puzzles";

export const DEFAULT_FEEDBACK_REPORT_DAYS = 30;
export const MAX_FEEDBACK_REPORT_DAYS = 365;
export const FEEDBACK_REPORT_COMMENT_LIMIT = 100;

export type FeedbackReportFilters = {
  days: number;
  puzzleNumber: number | null;
  pool: PuzzlePool | "all";
};

export type FeedbackReportSummary = {
  submissionCount: number;
  positivePercentage: number | null;
  solvedPercentage: number | null;
  averageGuesses: number | null;
  averageHints: number | null;
};

export type PuzzleFeedbackSummary = FeedbackReportSummary & {
  puzzleId: string;
  puzzleNumber: number;
  puzzlePool: PuzzlePool;
};

export type ReviewableFeedback = {
  createdAt: string;
  puzzleId: string;
  puzzleNumber: number;
  puzzlePool: PuzzlePool;
  rating: "up" | "down";
  outcome: "solved" | "revealed";
  guessCount: number;
  hintCount: number;
  comment: string | null;
};

export type FeedbackReport = {
  filters: FeedbackReportFilters;
  generatedAt: string;
  summary: FeedbackReportSummary;
  puzzles: PuzzleFeedbackSummary[];
  recentFeedback: ReviewableFeedback[];
};

type QueryBinding = string | number | null;

export type FeedbackReportQuery = {
  sql: string;
  bindings: QueryBinding[];
};

export type FeedbackReportQueries = {
  summary: FeedbackReportQuery;
  puzzles: FeedbackReportQuery;
  recentFeedback: FeedbackReportQuery;
};

export interface FeedbackReportPreparedStatement {
  bind(...values: QueryBinding[]): FeedbackReportPreparedStatement;
  all<T>(): Promise<{ results?: T[] }>;
}

export interface FeedbackReportDatabase {
  prepare(sql: string): FeedbackReportPreparedStatement;
}

type SummaryRow = {
  submissionCount?: unknown;
  positivePercentage?: unknown;
  solvedPercentage?: unknown;
  averageGuesses?: unknown;
  averageHints?: unknown;
};

type PuzzleSummaryRow = SummaryRow & {
  puzzleId?: unknown;
  puzzleNumber?: unknown;
  puzzlePool?: unknown;
};

type FeedbackRow = {
  createdAt?: unknown;
  puzzleId?: unknown;
  puzzleNumber?: unknown;
  puzzlePool?: unknown;
  rating?: unknown;
  outcome?: unknown;
  guessCount?: unknown;
  hintCount?: unknown;
  comment?: unknown;
};

export function parseFeedbackReportFilters(
  input: { days?: string | number | null; puzzle?: string | number | null; pool?: string | null },
  maximumPuzzleNumber: number,
): FeedbackReportFilters {
  const requestedDays = integerFrom(input.days);
  const days =
    requestedDays && requestedDays > 0
      ? Math.min(requestedDays, MAX_FEEDBACK_REPORT_DAYS)
      : DEFAULT_FEEDBACK_REPORT_DAYS;

  const requestedPuzzle = integerFrom(input.puzzle);
  const puzzleNumber =
    requestedPuzzle && requestedPuzzle > 0 && requestedPuzzle <= maximumPuzzleNumber
      ? requestedPuzzle
      : null;

  const pool = input.pool === "daily" || input.pool === "practice" ? input.pool : "all";
  return { days, puzzleNumber, pool };
}

export function buildFeedbackReportQueries(
  filters: FeedbackReportFilters,
  now = new Date(),
): FeedbackReportQueries {
  const cutoff = formatSqlTimestamp(new Date(now.getTime() - filters.days * 86_400_000));
  const conditions = ["created_at >= ?"];
  const bindings: QueryBinding[] = [cutoff];
  if (filters.pool !== "all") {
    conditions.push("puzzle_pool = ?");
    bindings.push(filters.pool);
  }
  if (filters.puzzleNumber !== null) {
    conditions.push("puzzle_number = ?");
    bindings.push(filters.puzzleNumber);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;

  return {
    summary: {
      sql: `SELECT
        COUNT(*) AS submissionCount,
        ROUND(100.0 * SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS positivePercentage,
        ROUND(100.0 * SUM(CASE WHEN outcome = 'solved' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS solvedPercentage,
        ROUND(AVG(guess_count), 1) AS averageGuesses,
        ROUND(AVG(hint_count), 1) AS averageHints
      FROM puzzle_feedback
      ${where}`,
      bindings,
    },
    puzzles: {
      sql: `SELECT
        puzzle_id AS puzzleId,
        puzzle_number AS puzzleNumber,
        puzzle_pool AS puzzlePool,
        COUNT(*) AS submissionCount,
        ROUND(100.0 * SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS positivePercentage,
        ROUND(100.0 * SUM(CASE WHEN outcome = 'solved' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS solvedPercentage,
        ROUND(AVG(guess_count), 1) AS averageGuesses,
        ROUND(AVG(hint_count), 1) AS averageHints
      FROM puzzle_feedback
      ${where}
      GROUP BY puzzle_id, puzzle_number, puzzle_pool
      ORDER BY puzzle_pool ASC, puzzle_number ASC`,
      bindings,
    },
    recentFeedback: {
      sql: `SELECT
        created_at AS createdAt,
        puzzle_id AS puzzleId,
        puzzle_number AS puzzleNumber,
        puzzle_pool AS puzzlePool,
        rating,
        outcome,
        guess_count AS guessCount,
        hint_count AS hintCount,
        comment
      FROM puzzle_feedback
      ${where}
        AND (rating = 'down' OR (comment IS NOT NULL AND TRIM(comment) <> ''))
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
      bindings: [...bindings, FEEDBACK_REPORT_COMMENT_LIMIT],
    },
  };
}

export async function getFeedbackReport(
  db: FeedbackReportDatabase,
  filters: FeedbackReportFilters,
  now = new Date(),
): Promise<FeedbackReport> {
  const queries = buildFeedbackReportQueries(filters, now);

  try {
    const summaryRows = await runQuery<SummaryRow>(db, queries.summary);
    const puzzleRows = await runQuery<PuzzleSummaryRow>(db, queries.puzzles);
    const feedbackRows = await runQuery<FeedbackRow>(db, queries.recentFeedback);

    return {
      filters,
      generatedAt: now.toISOString(),
      summary: normalizeSummary(summaryRows[0]),
      puzzles: puzzleRows.map(normalizePuzzleSummary),
      recentFeedback: feedbackRows.map(normalizeFeedback),
    };
  } catch (error) {
    if (!isMissingFeedbackTable(error)) throw error;
    return emptyFeedbackReport(filters, now);
  }
}

export function emptyFeedbackReport(
  filters: FeedbackReportFilters,
  now = new Date(),
): FeedbackReport {
  return {
    filters,
    generatedAt: now.toISOString(),
    summary: {
      submissionCount: 0,
      positivePercentage: null,
      solvedPercentage: null,
      averageGuesses: null,
      averageHints: null,
    },
    puzzles: [],
    recentFeedback: [],
  };
}

async function runQuery<T>(db: FeedbackReportDatabase, query: FeedbackReportQuery): Promise<T[]> {
  let statement = db.prepare(query.sql);
  if (query.bindings.length > 0) statement = statement.bind(...query.bindings);
  const result = await statement.all<T>();
  return result.results ?? [];
}

function normalizeSummary(row?: SummaryRow): FeedbackReportSummary {
  return {
    submissionCount: requiredNumber(row?.submissionCount),
    positivePercentage: optionalNumber(row?.positivePercentage),
    solvedPercentage: optionalNumber(row?.solvedPercentage),
    averageGuesses: optionalNumber(row?.averageGuesses),
    averageHints: optionalNumber(row?.averageHints),
  };
}

function normalizePuzzleSummary(row: PuzzleSummaryRow): PuzzleFeedbackSummary {
  return {
    puzzleId: requiredString(row.puzzleId),
    puzzleNumber: requiredNumber(row.puzzleNumber),
    puzzlePool: normalizePool(row.puzzlePool),
    ...normalizeSummary(row),
  };
}

function normalizeFeedback(row: FeedbackRow): ReviewableFeedback {
  return {
    createdAt: requiredString(row.createdAt),
    puzzleId: requiredString(row.puzzleId),
    puzzleNumber: requiredNumber(row.puzzleNumber),
    puzzlePool: normalizePool(row.puzzlePool),
    rating: row.rating === "down" ? "down" : "up",
    outcome: row.outcome === "revealed" ? "revealed" : "solved",
    guessCount: requiredNumber(row.guessCount),
    hintCount: requiredNumber(row.hintCount),
    comment: typeof row.comment === "string" && row.comment.length > 0 ? row.comment : null,
  };
}

function integerFrom(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) ? number : null;
}

function requiredNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requiredString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizePool(value: unknown): PuzzlePool {
  return value === "practice" ? "practice" : "daily";
}

function formatSqlTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isMissingFeedbackTable(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof Error && /no such table:\s*puzzle_feedback/i.test(current.message)) {
      return true;
    }
    current = typeof current === "object" && current !== null && "cause" in current
      ? (current as { cause?: unknown }).cause
      : null;
  }
  return false;
}
