import type { ReminderDeliveryResult } from './types.ts';

// The one decision process-reminders/index.ts needs to route a delivery
// result correctly: a SUCCESSFUL delivery is never retried (obviously), a
// NON-retryable failure (no email, permanently rejected) is 'skipped' --
// exactly today's existing terminal outcome, unchanged -- and only a
// RETRYABLE failure gets routed into the EXISTING attempt-count/
// MAX_ATTEMPTS mechanism (by throwing, so the already-proven catch block
// handles it exactly like a transient DB error always has). This function
// makes that routing decision testable on its own, without needing to
// exercise process-reminders' Deno.serve() handler directly.
export function shouldRetryReminderDelivery(result: ReminderDeliveryResult): boolean {
  return !result.delivered && result.retryable === true;
}
