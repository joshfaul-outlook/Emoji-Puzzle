import { resolve } from "node:path";
import { Miniflare } from "miniflare";
import {
  getFeedbackReport,
  parseFeedbackReportFilters,
  type FeedbackReport,
  type FeedbackReportDatabase,
} from "../lib/feedback-report.ts";
import { PUZZLES } from "../lib/puzzles.ts";

const LOCAL_DATABASE_ID = "00000000-0000-4000-8000-000000000000";

const rawFilters = parseArguments(process.argv.slice(2));
const filters = parseFeedbackReportFilters(rawFilters, PUZZLES.at(-1)?.number ?? PUZZLES.length);
const miniflare = new Miniflare({
  modules: true,
  script: "export default {}",
  d1Persist: resolve(".wrangler/state/v3/d1"),
  d1Databases: { DB: LOCAL_DATABASE_ID },
});

try {
  const db = await miniflare.getD1Database("DB");
  const report = await getFeedbackReport(db as unknown as FeedbackReportDatabase, filters);
  printReport(report);
} finally {
  await miniflare.dispose();
}

function parseArguments(args: string[]): { days?: string; puzzle?: string; pool?: string } {
  const parsed: { days?: string; puzzle?: string; pool?: string } = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--days" || argument === "--puzzle" || argument === "--pool") {
      const value = args[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      parsed[argument.slice(2) as "days" | "puzzle" | "pool"] = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--days=")) {
      parsed.days = argument.slice("--days=".length);
      continue;
    }
    if (argument.startsWith("--puzzle=")) {
      parsed.puzzle = argument.slice("--puzzle=".length);
      continue;
    }
    if (argument.startsWith("--pool=")) {
      parsed.pool = argument.slice("--pool=".length);
      continue;
    }
    if (argument === "--help") {
      console.log("Usage: npm run feedback:report -- [--days 30] [--pool daily|practice] [--puzzle 2]");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return parsed;
}

function printReport(report: FeedbackReport) {
  const scope = report.filters.puzzleNumber === null
    ? "all puzzles"
    : `puzzle #${report.filters.puzzleNumber}`;

  console.log(`Emoji Daily feedback report — last ${report.filters.days} days, ${report.filters.pool} pool, ${scope}`);
  console.log("All metrics are among feedback submissions; they do not measure total plays or abandonment.\n");
  console.log(`Submissions: ${report.summary.submissionCount}`);
  console.log(`Positive: ${formatPercentage(report.summary.positivePercentage)}`);
  console.log(`Solved: ${formatPercentage(report.summary.solvedPercentage)}`);
  console.log(`Average guesses: ${formatDecimal(report.summary.averageGuesses)}`);
  console.log(`Average hints: ${formatDecimal(report.summary.averageHints)}\n`);

  console.log("Per-puzzle breakdown");
  if (report.puzzles.length === 0) {
    console.log("  No feedback submissions match these filters.\n");
  } else {
    for (const row of report.puzzles) {
      console.log(
        `  ${row.puzzlePool} #${row.puzzleNumber} ${row.puzzleId}: ${row.submissionCount} submissions · ` +
        `${formatPercentage(row.positivePercentage)} positive · ` +
        `${formatPercentage(row.solvedPercentage)} solved · ` +
        `${formatDecimal(row.averageGuesses)} guesses · ${formatDecimal(row.averageHints)} hints`,
      );
    }
    console.log("");
  }

  console.log("Negative or written feedback");
  if (report.recentFeedback.length === 0) {
    console.log("  No matching feedback.");
    return;
  }
  for (const item of report.recentFeedback) {
    console.log(
      `  ${item.createdAt} · ${item.puzzlePool} #${item.puzzleNumber} · ${item.rating} · ${item.outcome} · ` +
      `${item.guessCount} guesses · ${item.hintCount} hints`,
    );
    console.log(`    ${item.comment ?? "No written comment."}`);
  }
}

function formatPercentage(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function formatDecimal(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}
