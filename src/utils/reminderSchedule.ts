// Direct file import + explicit '.ts' extension -- this module is
// reachable from both the process-reminders and process-recurring-plans
// Edge Functions' dependency graphs (Deno). See paymentAccounting.ts for
// the full rationale; same pattern, already proven safe for both Deno and
// the RN/Metro app.
import type { ReminderPreset, ReminderRule } from '../types/reminder.ts';

export const REMINDER_PRESETS: Record<Exclude<ReminderPreset, 'custom'>, ReminderRule[]> = {
  gentle: [
    { type: 'on_due', offsetValue: 0, offsetUnit: 'days' },
    { type: 'after_due', offsetValue: 5, offsetUnit: 'days' },
  ],
  standard: [
    { type: 'before_due', offsetValue: 2, offsetUnit: 'days' },
    { type: 'on_due', offsetValue: 0, offsetUnit: 'days' },
    { type: 'after_due', offsetValue: 3, offsetUnit: 'days' },
    { type: 'after_due', offsetValue: 7, offsetUnit: 'days' },
  ],
  frequent: [
    { type: 'before_due', offsetValue: 3, offsetUnit: 'days' },
    { type: 'before_due', offsetValue: 1, offsetUnit: 'days' },
    { type: 'on_due', offsetValue: 0, offsetUnit: 'days' },
    { type: 'after_due', offsetValue: 2, offsetUnit: 'days' },
    { type: 'after_due', offsetValue: 5, offsetUnit: 'days' },
  ],
};

export function rulesForPreset(preset: ReminderPreset, customRules: ReminderRule[] | undefined): ReminderRule[] {
  if (preset === 'custom') return customRules ?? [];
  return REMINDER_PRESETS[preset];
}

// Two entries are "the same reminder point" if they'd fire on the same day
// relative to the due date -- prevents e.g. "3 days after" + "3 days
// after" both existing in a custom schedule (see addCustomRule below).
function ruleKey(rule: ReminderRule): string {
  return `${rule.type}:${rule.offsetUnit === 'weeks' ? rule.offsetValue * 7 : rule.offsetValue}`;
}

export function addCustomRule(existing: ReminderRule[], rule: ReminderRule): ReminderRule[] {
  const key = ruleKey(rule);
  if (existing.some((r) => ruleKey(r) === key)) return existing;
  return [...existing, rule];
}

// --- Timezone-safe conversion -----------------------------------------
//
// Reminder timing is defined in wall-clock terms ("10:00 AM, 2 days before
// the due date, in the merchant's own timezone") and must be *stored* as a
// UTC instant (payment_reminders.scheduled_for) that a server-side cron
// can compare against `now()` correctly regardless of where the merchant
// is or DST shifts between when the schedule was created and when it
// fires. A bare UTC offset (e.g. "+05:00") captured once at schedule-
// creation time would silently go wrong across a DST transition or if the
// merchant travels -- an IANA zone name (e.g. "Asia/Karachi") is the only
// thing that stays correct, since it's resolved fresh at conversion time.
//
// No date library is used here (none is otherwise needed in this app) --
// this is a standard, well-known technique built on Intl.DateTimeFormat,
// which already carries the full IANA tzdata Hermes/JSC ship with.

function getZonedOffsetMinutes(utcInstant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utcInstant);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  // Reinterpreting the zoned wall-clock components as if they were UTC
  // gives "what UTC instant has this wall-clock in UTC" -- subtracting the
  // real UTC instant from that yields exactly the zone's current offset.
  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return (asIfUtc - utcInstant.getTime()) / 60000;
}

// Converts a wall-clock date/time in `timeZone` to the UTC instant it
// represents. One correction pass (using the offset near the target
// instant, not near epoch/now) is sufficient for scheduling purposes --
// the only residual edge case is a reminder landing exactly inside a
// skipped/repeated DST hour twice a year, an acceptable approximation for
// "remind around 10am", not a financial calculation.
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMinutes = getZonedOffsetMinutes(new Date(naiveUtc), timeZone);
  return new Date(naiveUtc - offsetMinutes * 60000);
}

// Exported for recurringSchedule.ts, which needs the identical "what
// calendar date is this timezone currently showing" primitive to compute a
// recurring plan's next occurrence -- one implementation of this, not two.
export function getZonedDateParts(instant: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

// Pure calendar-date arithmetic (no timezone involved at this step -- just
// adding whole days to a Y/M/D triple), anchored at UTC noon purely to
// avoid any local-midnight edge case in the *host* JS runtime -- this
// value is never rendered or stored, only its Y/M/D re-extracted.
function addCalendarDays(year: number, month: number, day: number, deltaDays: number) {
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));
  anchor.setUTCDate(anchor.getUTCDate() + deltaDays);
  return { year: anchor.getUTCFullYear(), month: anchor.getUTCMonth() + 1, day: anchor.getUTCDate() };
}

function ruleDeltaDays(rule: ReminderRule): number {
  const magnitude = rule.offsetUnit === 'weeks' ? rule.offsetValue * 7 : rule.offsetValue;
  if (rule.type === 'before_due') return -magnitude;
  if (rule.type === 'after_due') return magnitude;
  return 0;
}

export interface ComputedReminder {
  rule: ReminderRule;
  scheduledFor: Date;
}

// The single function both the client (previewing a schedule) and the
// reminder-saving code path (persisting payment_reminders rows) call --
// one implementation, so "what the merchant is shown" and "what actually
// gets scheduled" can never drift apart.
export function computeReminderOccurrences(
  dueAt: Date,
  rules: ReminderRule[],
  sendHour: number,
  sendMinute: number,
  timeZone: string
): ComputedReminder[] {
  const dueDateParts = getZonedDateParts(dueAt, timeZone);
  return rules.map((rule) => {
    const target = addCalendarDays(dueDateParts.year, dueDateParts.month, dueDateParts.day, ruleDeltaDays(rule));
    return { rule, scheduledFor: zonedTimeToUtc(target.year, target.month, target.day, sendHour, sendMinute, timeZone) };
  });
}

export function reminderRuleLabel(rule: ReminderRule): string {
  if (rule.type === 'on_due') return 'On due date';
  const unit = rule.offsetValue === 1 ? rule.offsetUnit.slice(0, -1) : rule.offsetUnit;
  return rule.type === 'before_due' ? `${rule.offsetValue} ${unit} before` : `${rule.offsetValue} ${unit} overdue`;
}

export function reminderScheduleSummary(rules: ReminderRule[]): string {
  if (rules.length === 0) return 'No reminders scheduled';
  return rules.map(reminderRuleLabel).join(' • ');
}

// "Tomorrow, 10:00 AM" / "Today, 10:00 AM" / "Sep 12, 10:00 AM" -- compares
// calendar dates in the *device's* local timezone (this is a display
// concern for whoever is looking at the screen, unlike scheduling itself
// which is anchored to the merchant's configured timezone).
export function formatReminderMoment(iso: string, now: Date = new Date()): string {
  const target = new Date(iso);
  const timeLabel = target.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);

  if (dayDiff === 0) return `Today, ${timeLabel}`;
  if (dayDiff === 1) return `Tomorrow, ${timeLabel}`;
  const dateLabel = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${dateLabel}, ${timeLabel}`;
}
