import { env } from "cloudflare:workers";
import {
  getFeedbackReport,
  type FeedbackReport,
  type FeedbackReportDatabase,
  type FeedbackReportFilters,
} from "../lib/feedback-report";

export function loadFeedbackReport(filters: FeedbackReportFilters): Promise<FeedbackReport> {
  if (!env.DB) throw new Error("Feedback database is unavailable");
  return getFeedbackReport(env.DB as unknown as FeedbackReportDatabase, filters);
}
