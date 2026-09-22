// The pure decision extracted from process-reminders/index.ts's per-
// reminder loop: given a just-claimed reminder's CURRENT (re-fetched, not
// cached) request/schedule state, is it still safe to actually send? A
// reminder claimed by claim_due_reminders (migration 0011's `for update
// skip locked`) is only guaranteed not to be claimed by a SECOND concurrent
// invocation -- it says nothing about whether the underlying request is
// still in a state that should be reminded about, which can change at any
// point between when it was scheduled and when this run picks it up
// (paid, cancelled, expired, or its schedule disabled in between). This is
// that second, independent check, factored out so it can be unit tested
// without a live Postgres/Deno runtime -- the Edge Function itself only
// does the I/O (fetching the request/schedule rows) and then calls this.
export interface ReminderEligibilityRequest {
  status: string;
  expiresAt: string | null;
}

export interface ReminderEligibilityInput {
  /** null means the payment_requests row this reminder points at no longer exists. */
  request: ReminderEligibilityRequest | null;
  /**
   * null when the reminder has no schedule_id to check (nothing to
   * disable); false/true is the schedule's own `enabled` column once
   * fetched.
   */
  scheduleEnabled: boolean | null;
  now?: Date;
}

/** Returns the specific ineligibility reason (stored verbatim as payment_reminders.last_error), or null when the reminder is still eligible to send. */
export function determineReminderIneligibilityReason(input: ReminderEligibilityInput): string | null {
  const now = input.now ?? new Date();

  if (!input.request) {
    return 'request_no_longer_exists';
  }
  // Covers paid, confirming, cancelled -- and, since a failed payment
  // confirmation reverts status back to 'pending' (there is no separate
  // "failed" payment_requests status), a request that briefly went to
  // 'confirming' and reverted simply becomes eligible again on its own,
  // with no special-case logic needed here.
  if (input.request.status !== 'pending') {
    return `request_status_is_${input.request.status}`;
  }
  if (input.request.expiresAt && new Date(input.request.expiresAt).getTime() <= now.getTime()) {
    return 'request_expired';
  }
  if (input.scheduleEnabled === false) {
    return 'schedule_disabled';
  }
  return null;
}
