import {
  computeReminderOccurrences,
  zonedTimeToUtc,
  reminderRuleLabel,
  reminderScheduleSummary,
  formatReminderMoment,
  rulesForPreset,
  addCustomRule,
  REMINDER_PRESETS,
} from '../reminderSchedule';
import type { ReminderRule } from '../../types';

describe('zonedTimeToUtc', () => {
  it('converts a wall-clock time in a positive-offset zone to the correct UTC instant', () => {
    // Asia/Karachi is UTC+5 year-round (no DST) -- 10:00 AM there on
    // 2026-09-10 is 05:00 UTC the same day.
    const utc = zonedTimeToUtc(2026, 9, 10, 10, 0, 'Asia/Karachi');
    expect(utc.toISOString()).toBe('2026-09-10T05:00:00.000Z');
  });

  it('converts a wall-clock time in a negative-offset zone to the correct UTC instant', () => {
    // America/New_York is UTC-4 in September (EDT) -- 10:00 AM there is
    // 14:00 UTC the same day.
    const utc = zonedTimeToUtc(2026, 9, 10, 10, 0, 'America/New_York');
    expect(utc.toISOString()).toBe('2026-09-10T14:00:00.000Z');
  });

  it('correctly resolves a different offset across a DST boundary in the same zone', () => {
    // America/New_York is UTC-5 in January (EST, no DST) -- the offset
    // must differ from the September (EDT) case above, proving this
    // isn't using a single cached/wrong offset.
    const utc = zonedTimeToUtc(2026, 1, 10, 10, 0, 'America/New_York');
    expect(utc.toISOString()).toBe('2026-01-10T15:00:00.000Z');
  });

  it('resolves UTC itself as a no-op offset', () => {
    const utc = zonedTimeToUtc(2026, 9, 10, 10, 0, 'UTC');
    expect(utc.toISOString()).toBe('2026-09-10T10:00:00.000Z');
  });
});

describe('computeReminderOccurrences', () => {
  const standardRules = REMINDER_PRESETS.standard;

  it('computes "before due" as calendar days before the due date, not a raw 24h subtraction', () => {
    // Due Sep 10 10:00 Karachi time -- "2 days before" must land on Sep 8,
    // at the configured send time, not 48 raw hours before the due
    // instant (which could cross into a different local calendar day
    // depending on due time vs send time).
    const dueAt = zonedTimeToUtc(2026, 9, 10, 15, 30, 'Asia/Karachi'); // due at an odd time of day
    const [beforeDue] = computeReminderOccurrences(dueAt, [standardRules[0]], 10, 0, 'Asia/Karachi');
    expect(beforeDue.scheduledFor.toISOString()).toBe(zonedTimeToUtc(2026, 9, 8, 10, 0, 'Asia/Karachi').toISOString());
  });

  it('computes "on due date" at the send time on the due date itself', () => {
    const dueAt = zonedTimeToUtc(2026, 9, 10, 23, 0, 'Asia/Karachi');
    const [onDue] = computeReminderOccurrences(dueAt, [standardRules[1]], 10, 0, 'Asia/Karachi');
    expect(onDue.scheduledFor.toISOString()).toBe(zonedTimeToUtc(2026, 9, 10, 10, 0, 'Asia/Karachi').toISOString());
  });

  it('computes "after due" (overdue) as calendar days after the due date', () => {
    const dueAt = zonedTimeToUtc(2026, 9, 10, 10, 0, 'Asia/Karachi');
    const results = computeReminderOccurrences(dueAt, standardRules, 10, 0, 'Asia/Karachi');
    const threeDaysAfter = results.find((r) => r.rule.type === 'after_due' && r.rule.offsetValue === 3)!;
    const sevenDaysAfter = results.find((r) => r.rule.type === 'after_due' && r.rule.offsetValue === 7)!;
    expect(threeDaysAfter.scheduledFor.toISOString()).toBe(zonedTimeToUtc(2026, 9, 13, 10, 0, 'Asia/Karachi').toISOString());
    expect(sevenDaysAfter.scheduledFor.toISOString()).toBe(zonedTimeToUtc(2026, 9, 17, 10, 0, 'Asia/Karachi').toISOString());
  });

  it('produces one occurrence per rule, in the order the rules were given', () => {
    const dueAt = zonedTimeToUtc(2026, 9, 10, 10, 0, 'UTC');
    const results = computeReminderOccurrences(dueAt, standardRules, 10, 0, 'UTC');
    expect(results).toHaveLength(4);
    expect(results.map((r) => r.rule)).toEqual(standardRules);
  });

  it('a week-based offset is treated as 7x the day count', () => {
    const dueAt = zonedTimeToUtc(2026, 9, 10, 10, 0, 'UTC');
    const rule: ReminderRule = { type: 'after_due', offsetValue: 1, offsetUnit: 'weeks' };
    const [result] = computeReminderOccurrences(dueAt, [rule], 10, 0, 'UTC');
    expect(result.scheduledFor.toISOString()).toBe(zonedTimeToUtc(2026, 9, 17, 10, 0, 'UTC').toISOString());
  });

  it('computes correctly across a month boundary', () => {
    const dueAt = zonedTimeToUtc(2026, 9, 1, 10, 0, 'UTC');
    const rule: ReminderRule = { type: 'before_due', offsetValue: 2, offsetUnit: 'days' };
    const [result] = computeReminderOccurrences(dueAt, [rule], 10, 0, 'UTC');
    expect(result.scheduledFor.toISOString()).toBe(zonedTimeToUtc(2026, 8, 30, 10, 0, 'UTC').toISOString());
  });

  it('two different timezones for the same due instant produce different scheduled_for values', () => {
    // The due instant is identical; the "calendar day" it falls on differs
    // by timezone (this due instant is already Sep 11 in Karachi but still
    // Sep 10 in New York), so "2 days before" must differ between them --
    // this is exactly the class of bug a UTC-offset-only implementation
    // would get wrong.
    const dueAt = new Date('2026-09-10T23:00:00.000Z');
    const [karachi] = computeReminderOccurrences(dueAt, [{ type: 'before_due', offsetValue: 2, offsetUnit: 'days' }], 10, 0, 'Asia/Karachi');
    const [newYork] = computeReminderOccurrences(dueAt, [{ type: 'before_due', offsetValue: 2, offsetUnit: 'days' }], 10, 0, 'America/New_York');
    expect(karachi.scheduledFor.toISOString()).not.toBe(newYork.scheduledFor.toISOString());
  });
});

describe('rulesForPreset', () => {
  it('returns the fixed rule set for a named preset', () => {
    expect(rulesForPreset('gentle', undefined)).toEqual(REMINDER_PRESETS.gentle);
    expect(rulesForPreset('standard', undefined)).toEqual(REMINDER_PRESETS.standard);
    expect(rulesForPreset('frequent', undefined)).toEqual(REMINDER_PRESETS.frequent);
  });

  it('returns the custom rules for the custom preset', () => {
    const custom: ReminderRule[] = [{ type: 'after_due', offsetValue: 10, offsetUnit: 'days' }];
    expect(rulesForPreset('custom', custom)).toEqual(custom);
  });

  it('returns an empty array for custom with no rules yet', () => {
    expect(rulesForPreset('custom', undefined)).toEqual([]);
  });
});

describe('addCustomRule', () => {
  it('adds a new rule', () => {
    const result = addCustomRule([], { type: 'after_due', offsetValue: 3, offsetUnit: 'days' });
    expect(result).toHaveLength(1);
  });

  it('prevents an exact duplicate (same type + equivalent day offset)', () => {
    const existing: ReminderRule[] = [{ type: 'after_due', offsetValue: 3, offsetUnit: 'days' }];
    const result = addCustomRule(existing, { type: 'after_due', offsetValue: 3, offsetUnit: 'days' });
    expect(result).toBe(existing); // unchanged, not a new array with a duplicate
    expect(result).toHaveLength(1);
  });

  it('treats a week-equivalent day offset as the same rule (1 week after == 7 days after)', () => {
    const existing: ReminderRule[] = [{ type: 'after_due', offsetValue: 7, offsetUnit: 'days' }];
    const result = addCustomRule(existing, { type: 'after_due', offsetValue: 1, offsetUnit: 'weeks' });
    expect(result).toHaveLength(1);
  });

  it('allows the same offset with a different direction (2 days before is not 2 days after)', () => {
    const existing: ReminderRule[] = [{ type: 'before_due', offsetValue: 2, offsetUnit: 'days' }];
    const result = addCustomRule(existing, { type: 'after_due', offsetValue: 2, offsetUnit: 'days' });
    expect(result).toHaveLength(2);
  });
});

describe('reminderRuleLabel / reminderScheduleSummary', () => {
  it('labels on_due distinctly', () => {
    expect(reminderRuleLabel({ type: 'on_due', offsetValue: 0, offsetUnit: 'days' })).toBe('On due date');
  });

  it('labels before/after with singular/plural units', () => {
    expect(reminderRuleLabel({ type: 'before_due', offsetValue: 1, offsetUnit: 'days' })).toBe('1 day before');
    expect(reminderRuleLabel({ type: 'before_due', offsetValue: 2, offsetUnit: 'days' })).toBe('2 days before');
    expect(reminderRuleLabel({ type: 'after_due', offsetValue: 7, offsetUnit: 'days' })).toBe('7 days overdue');
  });

  it('summarizes a full schedule as a compact, ordered string', () => {
    expect(reminderScheduleSummary(REMINDER_PRESETS.standard)).toBe(
      '2 days before • On due date • 3 days overdue • 7 days overdue'
    );
  });

  it('summarizes an empty schedule', () => {
    expect(reminderScheduleSummary([])).toBe('No reminders scheduled');
  });
});

describe('formatReminderMoment', () => {
  const now = new Date(2026, 8, 10, 9, 0); // Sep 10 2026, local time

  it('labels the same calendar day as "Today"', () => {
    const target = new Date(2026, 8, 10, 15, 30).toISOString();
    expect(formatReminderMoment(target, now)).toMatch(/^Today, /);
  });

  it('labels the next calendar day as "Tomorrow"', () => {
    const target = new Date(2026, 8, 11, 10, 0).toISOString();
    expect(formatReminderMoment(target, now)).toMatch(/^Tomorrow, /);
  });

  it('labels a further-out date with month and day', () => {
    const target = new Date(2026, 8, 17, 10, 0).toISOString();
    expect(formatReminderMoment(target, now)).toMatch(/^Sep 17, /);
  });
});
