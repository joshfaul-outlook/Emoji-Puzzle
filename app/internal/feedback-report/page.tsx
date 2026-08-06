import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { env } from "cloudflare:workers";
import { chatGPTSignOutPath, requireChatGPTUser } from "../../chatgpt-auth";
import { loadFeedbackReport } from "../../../db/feedback-report";
import { isFeedbackReviewer } from "../../../lib/feedback-review-auth";
import { parseFeedbackReportFilters } from "../../../lib/feedback-report";
import { getPuzzleByNumber, PUZZLES } from "../../../lib/puzzles";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Feedback report — Emoji Daily",
  robots: { index: false, follow: false },
};

type ReportPageProps = {
  searchParams: Promise<{ days?: string; puzzle?: string }>;
};

export default async function FeedbackReportPage({ searchParams }: ReportPageProps) {
  const params = await searchParams;
  const maximumPuzzleNumber = PUZZLES.at(-1)?.number ?? PUZZLES.length;
  const filters = parseFeedbackReportFilters(params, maximumPuzzleNumber);
  const query = new URLSearchParams({ days: String(filters.days) });
  if (filters.puzzleNumber !== null) query.set("puzzle", String(filters.puzzleNumber));
  const returnTo = `/internal/feedback-report?${query.toString()}`;

  return <ProtectedFeedbackReport returnTo={returnTo} filters={filters} />;
}

async function ProtectedFeedbackReport({
  returnTo,
  filters,
}: {
  returnTo: string;
  filters: ReturnType<typeof parseFeedbackReportFilters>;
}) {
  const user = await requireChatGPTUser(returnTo);
  const reviewerEmails = (env as unknown as { FEEDBACK_REVIEWER_EMAILS?: string })
    .FEEDBACK_REVIEWER_EMAILS;
  if (!isFeedbackReviewer(user.email, reviewerEmails)) notFound();

  const report = await loadFeedbackReport(filters);
  const selectedPuzzle = filters.puzzleNumber === null
    ? null
    : getPuzzleByNumber(filters.puzzleNumber);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <span className={styles.brandMark} aria-hidden="true">☺</span>
          Emoji Daily
        </Link>
        <div className={styles.account}>
          <span>Signed in as {user.displayName}</span>
          <a href={chatGPTSignOutPath(returnTo)}>Sign out</a>
        </div>
      </header>

      <section className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Internal · read only</p>
          <h1 className={styles.title}>Feedback report</h1>
          <p className={styles.subtitle}>
            Directional puzzle-quality signals among feedback submissions. This does not measure
            total plays or abandonment.
          </p>
        </div>
        <form className={styles.filters} method="get">
          <label>
            Time range
            <select name="days" defaultValue={String(filters.days)}>
              {[7, 30, 90, 365].map((days) => (
                <option key={days} value={days}>Last {days} days</option>
              ))}
            </select>
          </label>
          <label>
            Puzzle
            <select name="puzzle" defaultValue={filters.puzzleNumber ?? ""}>
              <option value="">All puzzles</option>
              {PUZZLES.map((puzzle) => (
                <option key={puzzle.id} value={puzzle.number}>
                  #{puzzle.number} · {puzzle.emoji} · {puzzle.answer}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Apply filters</button>
        </form>
      </section>

      <section aria-labelledby="summary-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Among feedback submissions</p>
            <h2 id="summary-title">
              {selectedPuzzle ? `Puzzle #${selectedPuzzle.number}` : "Overall summary"}
            </h2>
          </div>
          <p>Generated {formatDateTime(report.generatedAt)}</p>
        </div>
        <div className={styles.metrics}>
          <Metric label="Submissions" value={String(report.summary.submissionCount)} />
          <Metric label="Positive" value={formatPercentage(report.summary.positivePercentage)} />
          <Metric label="Solved" value={formatPercentage(report.summary.solvedPercentage)} />
          <Metric label="Avg. guesses" value={formatDecimal(report.summary.averageGuesses)} />
          <Metric label="Avg. hints" value={formatDecimal(report.summary.averageHints)} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="puzzles-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Comparison</p>
            <h2 id="puzzles-title">Per-puzzle breakdown</h2>
          </div>
          <p>All values are based only on submitted feedback.</p>
        </div>
        {report.puzzles.length === 0 ? (
          <EmptyState>No feedback submissions match these filters yet.</EmptyState>
        ) : (
          <div className={styles.tableFrame}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Puzzle</th>
                  <th scope="col">Submissions</th>
                  <th scope="col">Positive</th>
                  <th scope="col">Solved</th>
                  <th scope="col">Avg. guesses</th>
                  <th scope="col">Avg. hints</th>
                </tr>
              </thead>
              <tbody>
                {report.puzzles.map((row) => {
                  const puzzle = getPuzzleByNumber(row.puzzleNumber);
                  return (
                    <tr key={row.puzzleId}>
                      <th scope="row">
                        <span className={styles.puzzleName}>
                          <span aria-hidden="true">{puzzle?.emoji ?? "🧩"}</span>
                          <span>#{row.puzzleNumber} · {puzzle?.answer ?? row.puzzleId}</span>
                        </span>
                      </th>
                      <td>{row.submissionCount}</td>
                      <td>{formatPercentage(row.positivePercentage)}</td>
                      <td>{formatPercentage(row.solvedPercentage)}</td>
                      <td>{formatDecimal(row.averageGuesses)}</td>
                      <td>{formatDecimal(row.averageHints)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="feedback-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Read next</p>
            <h2 id="feedback-title">Negative or written feedback</h2>
          </div>
          <p>Newest first · up to 100 results</p>
        </div>
        {report.recentFeedback.length === 0 ? (
          <EmptyState>No negative ratings or written comments match these filters.</EmptyState>
        ) : (
          <div className={styles.feedbackList}>
            {report.recentFeedback.map((item, index) => {
              const puzzle = getPuzzleByNumber(item.puzzleNumber);
              return (
                <article className={styles.feedbackCard} key={`${item.createdAt}-${item.puzzleId}-${index}`}>
                  <div className={styles.feedbackMeta}>
                    <span className={item.rating === "down" ? styles.negative : styles.positive}>
                      {item.rating === "down" ? "Thumbs down" : "Thumbs up"}
                    </span>
                    <span>#{item.puzzleNumber} · {puzzle?.answer ?? item.puzzleId}</span>
                    <span>{item.outcome}</span>
                    <span>{item.guessCount} guesses · {item.hintCount} hints</span>
                    <time dateTime={toIsoDate(item.createdAt)}>{formatDateTime(item.createdAt)}</time>
                  </div>
                  <p>{item.comment ?? "No written comment."}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={`${styles.section} ${styles.routine}`} aria-labelledby="routine-title">
        <div>
          <p className={styles.eyebrow}>Every five submissions or three days</p>
          <h2 id="routine-title">Manual review routine</h2>
          <ol>
            <li>Check the overall and per-puzzle signals.</li>
            <li>Read every negative rating and written comment.</li>
            <li>Classify the comment with one of the research tags.</li>
            <li>Choose keep, revise, replace, or retest for each reviewed puzzle.</li>
            <li>Save a dated review note with evidence and the chosen action.</li>
          </ol>
        </div>
        <div>
          <p className={styles.tagHeading}>Research tags</p>
          <div className={styles.tags}>
            {["delight", "ambiguous", "too-easy", "too-hard", "unfamiliar", "hint-helpful", "hint-spoiled", "variant-missed", "interaction", "technical"].map((tag) => (
              <code key={tag}>{tag}</code>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.metric}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

function formatPercentage(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function formatDecimal(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function formatDateTime(value: string): string {
  const date = new Date(toIsoDate(value));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date) + " UTC";
}

function toIsoDate(value: string): string {
  return value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
}
