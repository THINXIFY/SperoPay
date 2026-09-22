import {
  resolveReportDateRange,
  getPreviousReportDateRange,
  isDateInRange,
  REPORT_DATE_RANGE_OPTIONS,
} from '../reportDateRange';

// A fixed "now" mid-month so month/year boundaries are unambiguous:
// 2026-03-15 12:00 UTC.
const NOW = new Date(2026, 2, 15, 12, 0, 0);

describe('REPORT_DATE_RANGE_OPTIONS', () => {
  it('lists all nine presets in spec order', () => {
    expect(REPORT_DATE_RANGE_OPTIONS.map((o) => o.value)).toEqual([
      'today',
      '7d',
      '30d',
      'thisMonth',
      'lastMonth',
      '3m',
      '6m',
      'thisYear',
      'custom',
    ]);
  });
});

describe('resolveReportDateRange', () => {
  it('today is the current calendar day only', () => {
    const range = resolveReportDateRange('today', NOW);
    expect(range.start).toEqual(new Date(2026, 2, 15));
    expect(range.end).toEqual(new Date(2026, 2, 16));
  });

  it('7d includes today plus the 6 preceding days', () => {
    const range = resolveReportDateRange('7d', NOW);
    expect(range.start).toEqual(new Date(2026, 2, 9));
    expect(range.end).toEqual(new Date(2026, 2, 16));
  });

  it('30d includes today plus the 29 preceding days', () => {
    const range = resolveReportDateRange('30d', NOW);
    expect(range.start).toEqual(new Date(2026, 1, 14));
    expect(range.end).toEqual(new Date(2026, 2, 16));
  });

  it('thisMonth is the full current calendar month', () => {
    const range = resolveReportDateRange('thisMonth', NOW);
    expect(range.start).toEqual(new Date(2026, 2, 1));
    expect(range.end).toEqual(new Date(2026, 3, 1));
  });

  it('lastMonth is the full previous calendar month', () => {
    const range = resolveReportDateRange('lastMonth', NOW);
    expect(range.start).toEqual(new Date(2026, 1, 1));
    expect(range.end).toEqual(new Date(2026, 2, 1));
  });

  it('lastMonth rolls back across a year boundary correctly', () => {
    const january = new Date(2026, 0, 10);
    const range = resolveReportDateRange('lastMonth', january);
    expect(range.start).toEqual(new Date(2025, 11, 1));
    expect(range.end).toEqual(new Date(2026, 0, 1));
  });

  it('thisYear is the full current calendar year', () => {
    const range = resolveReportDateRange('thisYear', NOW);
    expect(range.start).toEqual(new Date(2026, 0, 1));
    expect(range.end).toEqual(new Date(2027, 0, 1));
  });

  it('custom uses the supplied start/end verbatim when valid', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 15);
    const range = resolveReportDateRange('custom', NOW, { start, end });
    expect(range.start).toBe(start);
    expect(range.end).toBe(end);
  });

  it('custom falls back to today when start >= end (never silently uses a backwards range)', () => {
    const start = new Date(2026, 0, 15);
    const end = new Date(2026, 0, 1);
    const range = resolveReportDateRange('custom', NOW, { start, end });
    expect(range.start).toEqual(new Date(2026, 2, 15));
    expect(range.end).toEqual(new Date(2026, 2, 16));
  });

  it('custom falls back to today when no custom value is supplied', () => {
    const range = resolveReportDateRange('custom', NOW);
    expect(range.start).toEqual(new Date(2026, 2, 15));
    expect(range.end).toEqual(new Date(2026, 2, 16));
  });
});

describe('getPreviousReportDateRange', () => {
  it('previous of thisMonth is lastMonth', () => {
    const range = resolveReportDateRange('thisMonth', NOW);
    const previous = getPreviousReportDateRange(range);
    expect(previous.start).toEqual(new Date(2026, 1, 1));
    expect(previous.end).toEqual(new Date(2026, 2, 1));
  });

  it('previous of thisYear is the full prior year', () => {
    const range = resolveReportDateRange('thisYear', NOW);
    const previous = getPreviousReportDateRange(range);
    expect(previous.start).toEqual(new Date(2025, 0, 1));
    expect(previous.end).toEqual(new Date(2026, 0, 1));
  });

  it('previous of a rolling 7d window is the same-length window immediately before it', () => {
    const range = resolveReportDateRange('7d', NOW);
    const previous = getPreviousReportDateRange(range);
    const durationMs = range.end.getTime() - range.start.getTime();
    expect(previous.end).toEqual(range.start);
    expect(previous.end.getTime() - previous.start.getTime()).toBe(durationMs);
  });

  it('previous of a custom range is the same-length window immediately before it', () => {
    const range = resolveReportDateRange('custom', NOW, { start: new Date(2026, 0, 10), end: new Date(2026, 0, 20) });
    const previous = getPreviousReportDateRange(range);
    expect(previous.start).toEqual(new Date(2025, 11, 31));
    expect(previous.end).toEqual(new Date(2026, 0, 10));
  });
});

describe('isDateInRange', () => {
  const range = resolveReportDateRange('thisMonth', NOW);

  it('includes a timestamp exactly at the inclusive start', () => {
    expect(isDateInRange(range.start.toISOString(), range)).toBe(true);
  });

  it('excludes a timestamp exactly at the exclusive end', () => {
    expect(isDateInRange(range.end.toISOString(), range)).toBe(false);
  });

  it('includes a timestamp inside the range', () => {
    expect(isDateInRange(new Date(2026, 2, 15).toISOString(), range)).toBe(true);
  });

  it('excludes a timestamp before the range', () => {
    expect(isDateInRange(new Date(2026, 1, 28).toISOString(), range)).toBe(false);
  });
});
