// The provider abstraction the whole reminder-delivery story is built
// around. Moved here (from supabase/functions/process-reminders/
// deliveryProvider.ts) so it lives in the one place this project already
// puts logic shared between the RN app's bundle and Deno Edge Functions --
// reachable from Deno via an explicit '.ts'-suffixed relative import, same
// convention as paymentAccounting.ts / solanaPayUri.ts.
export interface ReminderDeliveryContext {
  channel: 'email' | 'sms' | 'whatsapp';
  customerName?: string;
  /** Required for an email provider to do anything; a provider must treat a missing/invalid address as a non-retryable failure, never throw. */
  customerEmail?: string | null;
  merchantName: string;
  amount: number;
  currency: string;
  paymentCode: string;
  dueAt?: string | null;
  /** The exact tone-aware body from buildAutomaticReminderMessage.ts -- every provider reuses this verbatim rather than deriving its own copy. */
  message: string;
  paymentLink: string;
}

export interface ReminderDeliveryResult {
  delivered: boolean;
  /** Set only when delivered === true, to what actually carried it. */
  channel?: string;
  /**
   * Set only when delivered === false -- a short, stable machine reason
   * (stored verbatim in payment_reminders.last_error), never a raw
   * provider stack trace, response body, or anything else that isn't safe
   * to store.
   */
  reason?: string;
  /**
   * Only meaningful when delivered === false. true means the failure is
   * plausibly transient (a provider outage, a 5xx, a network error) and
   * worth letting the EXISTING attempt-count/retry mechanism in
   * process-reminders/index.ts have another go at on a later scheduled
   * run. false/undefined means retrying can never help (no usable email,
   * the provider permanently rejected the recipient/request) -- treated
   * exactly like today's terminal 'skipped' outcome.
   */
  retryable?: boolean;
}

export interface ReminderDeliveryProvider {
  send(context: ReminderDeliveryContext): Promise<ReminderDeliveryResult>;
}
