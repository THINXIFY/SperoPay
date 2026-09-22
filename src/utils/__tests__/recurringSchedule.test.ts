import { addInterval, computeNextRunAt, recurringFrequencyLabel, formatRecurringDate } from '../recurringSchedule';
import { zonedTimeToUtc } from '../reminderSchedule';

describe('addInterval', () => {
  it('adds 7 days for weekly', () => {
    expect(addInterval(2026, 9, 10, 'weekly')).toEqual({ year: 2026, month: 9, day: 17 });
  });

  it('adds 14 days for biweekly', () => {
    expect(addInterval(2026, 9, 10, 'biweekly')).toEqual({ year: 2026, month: 9, day: 24 });
  });

  it('adds 1 calendar month for monthly, crossing a year boundary correctly', () => {
    expect(addInterval(2026, 12, 10, 'monthly')).toEqual({ year: 2027, month: 1, day: 10 });
  });

  it('clamps day-of-month overflow for monthly (Jan 31 -> Feb 28, non-leap year)', () => {
    expect(addInterval(2027, 1, 31, 'monthly')).toEqual({ year: 2027, month: 2, day: 28 });
  });

  it('clamps day-of-month overflow for monthly in a leap year (Jan 31 -> Feb 29)', () => {
    expect(addInterval(2028, 1, 31, 'monthly')).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it('adds 3 calendar months for quarterly', () => {
    expect(addInterval(2026, 9, 10, 'quarterly')).toEqual({ year: 2026, month: 12, day: 10 });
  });

  it('adds 12 calendar months for yearly, preserving Feb 29 by clamping in a non-leap target year', () => {
    expect(addInterval(2028, 2, 29, 'yearly')).toEqual({ year: 2029, month: 2, day: 28 });
  });

  it('adds a custom number of days', () => {
    expect(addInterval(2026, 9, 10, 'custom', 45)).toEqual({ year: 2026, month: 10, day: 25 });
  });

  it('treats a missing/zero custom interval as at least 1 day (never a no-op or backwards step)', () => {
    expect(addInterval(2026, 9, 10, 'custom', 0)).toEqual({ year: 2026, month: 9, day: 11 });
  });
});

describe('computeNextRunAt', () => {
  it('resolves the next monthly occurrence to the correct UTC instant in a real IANA timezone', () => {
    const from = zonedTimeToUtc(2026, 9, 10, 9, 0, 'Asia/Karachi');
    const next = computeNextRunAt(from, 'Asia/Karachi', 'monthly', null, 9, 0);
    expect(next.toISOString()).toBe(zonedTimeToUtc(2026, 10, 10, 9, 0, 'Asia/Karachi').toISOString());
  });

  it('resolves correctly across a DST boundary', () => {
    const from = zonedTimeToUtc(2026, 10, 15, 9, 0, 'America/New_York'); // EDT
    const next = computeNextRunAt(from, 'America/New_York', 'monthly', null, 9, 0); // lands in November, EST
    expect(next.toISOString()).toBe(zonedTimeToUtc(2026, 11, 15, 9, 0, 'America/New_York').toISOString());
  });
});

describe('recurringFrequencyLabel', () => {
  it('labels fixed frequencies', () => {
    expect(recurringFrequencyLabel('monthly')).toBe('Monthly');
    expect(recurringFrequencyLabel('biweekly')).toBe('Every 2 weeks');
  });

  it('labels a custom interval with its day count', () => {
    expect(recurringFrequencyLabel('custom', 45)).toBe('Every 45 days');
    expect(recurringFrequencyLabel('custom', 1)).toBe('Every 1 day');
  });
});

describe('formatRecurringDate', () => {
  it('omits the year when it matches the current year', () => {
    const now = new Date(2026, 8, 1);
    expect(formatRecurringDate(new Date(2026, 9, 1).toISOString(), now)).toBe('Oct 1');
  });

  it('includes the year when it differs from the current year', () => {
    const now = new Date(2026, 8, 1);
    expect(formatRecurringDate(new Date(2027, 9, 1).toISOString(), now)).toBe('Oct 1, 2027');
  });
});
