// Beta feedback: builds a link that opens the person's email app, or a GitHub issue, with their note filled in.
import { FEEDBACK } from "./data";

/** Links that open the person's own email app (or a GitHub issue) with their note filled in. */
export function feedbackLink(text: string, version: string, to: { email: string; issues: string } = FEEDBACK): string {
  const subject = "Pantry Prep feedback";
  const body = `${text.trim()}\n\n(Pantry Prep ${version})`;
  if (to.email) return `mailto:${to.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return `${to.issues}?title=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

