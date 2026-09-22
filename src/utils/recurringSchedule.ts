// Direct file imports + explicit '.ts' extensions -- this module is
// reachable from the process-recurring-plans Edge Function's dependency
// graph (Deno). See paymentAccounting.ts for the full rationale; same
// pattern, already proven safe for both Deno and the RN/Metro app.
import type { RecurringFrequency } from '../types/recurring.ts';
import { zonedTimeToUtc, getZonedDateParts } from './reminderSchedule.ts';

// Mirrors reminderSchedule.ts's own hard-earned rule: never do calendar-date
// math as raw millisecond/day arithmetic on a timezone-naive Date — always
// extract/recombine explicit Y/M/D parts. Reused here for the exact same
// reason: "add 1 month" must respect real calendar semantics (Jan 31 -> Feb
// 28, not Mar 3), and "add N days" must land on the correct calendar day in
// the plan's own configured timezone, not an arbitrary UTC-instant offset.

function daysInMonth(year: number, month: number): number {
  // month is 1-12. Day 0 of the *next* month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Exported for process-recurring-plans, which needs plain calendar-day
// addition directly (e.g. for a due-date offset of 0, meaning "due the
// same day it's generated") -- addInterval's own 'custom' case floors at 1
// day, which is correct for a recurring interval (a plan can't repeat
// every 0 days) but wrong for a due-date offset, where 0 is legitimate.
export function addCalendarDays(year: number, month: number, day: number, deltaDays: number) {
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));
  anchor.setUTCDate(anchor.getUTCDate() + deltaDays);
  return { year: anchor.getUTCFullYear(), month: anchor.getUTCMonth() + 1, day: anchor.getUTCDate() };
}

// Adding N months to day-of-month 31 when the target month is shorter must
// clamp to that month's real last day (Jan 31 + 1 month = Feb 28/29, never
// "overflow" into March) -- this is the one behavior naive
// `date + interval '1 month'` arithmetic gets wrong in some engines/inputs,
// so it's made explicit and tested here rather than trusted implicitly.
function addCalendarMonths(year: number, month: number, day: number, deltaMonths: number) {
  const totalMonths = (year * 12 + (month - 1)) + deltaMonths;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return { year: targetYear, month: targetMonth, day: clampedDay };
}

export function addInterval(
  year: number,
  month: number,
  day: number,
  frequency: RecurringFrequency,
  customIntervalDays?: number | null
) {
  switch (frequency) {
    case 'weekly':
      return addCalendarDays(year, month, day, 7);
    case 'biweekly':
      return addCalendarDays(year, month, day, 14);
    case 'monthly':
      return addCalendarMonths(year, month, day, 1);
    case 'quarterly':
      return addCalendarMonths(year, month, day, 3);
    case 'yearly':
      return addCalendarMonths(year, month, day, 12);
    case 'custom':
      return addCalendarDays(year, month, day, Math.max(1, customIntervalDays ?? 1));
    default:
      return { year, month, day };
  }
}

// Computes the next UTC instant a plan should generate at, given the last
// occurrence's calendar date (or the plan's start_date for the very first
// occurrence) IN THE PLAN'S OWN TIMEZONE -- an IANA zone, never a bare UTC
// offset, for the identical DST/travel-safety reason reminderSchedule.ts
// documents. `sendHour`/`sendMinute` let a plan generate at a specific time
// of day rather than always at local midnight.
export function computeNextRunAt(
  fromDate: Date,
  timezone: string,
  frequency: RecurringFrequency,
  customIntervalDays: number | null | undefined,
  sendHour: number,
  sendMinute: number
): Date {
  const parts = getZonedDateParts(fromDate, timezone);
  const next = addInterval(parts.year, parts.month, parts.day, frequency, customIntervalDays);
  return zonedTimeToUtc(next.year, next.month, next.day, sendHour, sendMinute, timezone);
}

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  custom: 'Custom',
};

export function recurringFrequencyLabel(frequency: RecurringFrequency, customIntervalDays?: number | null): string {
  if (frequency === 'custom' && customIntervalDays) {
    return `Every ${customIntervalDays} day${customIntervalDays === 1 ? '' : 's'}`;
  }
  return RECURRING_FREQUENCY_LABELS[frequency];
}

// "Oct 1" / "Oct 1, 2027" (year only shown when it isn't the current year --
// a recurring plan's "Next request" date is far more often read within the
// same year it's shown in, so the common case stays compact).
export function formatRecurringDate(iso: string, now: Date = new Date()): string {
  const target = new Date(iso);
  const sameYear = target.getFullYear() === now.getFullYear();
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}
