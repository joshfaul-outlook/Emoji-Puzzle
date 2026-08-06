export const FEEDBACK_REVIEWER_EMAIL = "josh.faul@outlook.com";

export function isFeedbackReviewer(email: string): boolean {
  return email.trim().toLocaleLowerCase("en") === FEEDBACK_REVIEWER_EMAIL;
}
