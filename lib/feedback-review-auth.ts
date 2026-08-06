export function parseFeedbackReviewerEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLocaleLowerCase("en"))
      .filter(Boolean),
  );
}

export function isFeedbackReviewer(email: string, configuredEmails: string | undefined): boolean {
  return parseFeedbackReviewerEmails(configuredEmails).has(email.trim().toLocaleLowerCase("en"));
}
