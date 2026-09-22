// '.ts' extension required: this file is reachable from the verify-payment
// Edge Function's dependency graph (via paymentAccounting.ts), and Deno's
// local-module resolution requires an explicit extension on every relative
// import -- unlike the RN/Metro build, which already tolerates this too
// (see paymentAccounting.ts's own comment on this).
import type { ReminderPreset, ReminderRule } from './reminder.ts';
import type { AssetSymbol } from '../config/assets.ts';

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export type DepositType = 'fixed' | 'percentage';

export interface RecurringPlan {
  id: string;
  customerId?: string;
  amount: number;
  // Phase 7: 'USDC' | 'EURC', permanent for this plan -- generated
  // requests keep using it even if the business default currency changes
  // later (see generate_recurring_request, which threads v_plan.currency
  // through unchanged).
  currency: AssetSymbol;
  network: 'Solana';
  description?: string;
  note?: string;
  frequency: RecurringFrequency;
  // Only meaningful when frequency === 'custom'.
  customIntervalDays?: number;
  // Days after a generated request is created that it becomes due --
  // undefined means the generated request has no due date (and therefore
  // no reminders, same rule as an ordinary request -- see reminderSchedule).
  dueDateOffsetDays?: number;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  occurrencesGenerated: number;
  // The next UTC instant the server-side processor will generate a request
  // for this plan -- always in the future for an active plan; stale (in the
  // past) only for the brief window between becoming due and the next
  // processor tick.
  nextRunAt: string;
  sendHour: number;
  sendMinute: number;
  timezone: string;
  active: boolean;
  allowPartialPayments: boolean;
  depositType?: DepositType;
  depositValue?: number;
  remindersEnabled: boolean;
  reminderPreset: ReminderPreset;
  reminderCustomRules?: ReminderRule[];
  // Informational only -- a snapshot origin, never re-read for values.
  // Editing the source template later must never rewrite this plan or any
  // request it already generated.
  sourceTemplateId?: string;
  createdAt: string;
  // Phase 5C reliability observability (migration 0016) -- consecutiveFailures
  // resets to 0 on every successful generation attempt (including a benign
  // "plan is now inactive" skip) and increments on a genuine generation
  // error; it never bounds/stops retrying, it only makes a stuck plan
  // visible to the merchant (see Automation Overview). 0/undefined for
  // every plan that has never failed.
  consecutiveFailures?: number;
  lastError?: string;
  lastAttemptedAt?: string;
}
