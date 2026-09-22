// Reports' date-range selector -- a strictly larger set of options than
// Analytics' fixed 7D/30D/3M/6M/1Y trend periods (see analytics.ts), because
// Reports needs real calendar ranges (This Month, Last Month, This Year) and
// an open Custom Range, not just rolling trend windows. Deliberately a
// separate file rather than extending analytics.ts's RevenueTrendPeriod:
// that type is a chart-bucket granularity, this is a plain [start, end)
// filter range -- conflating them would make analytics.ts's existing chart
// code responsible for concerns (calendar-month boundaries, custom ranges)
// it was never designed around.
export type ReportDateRangePreset =
  | 'today'
  | '7d'
  | '30d'
  | 'thisMonth'
  | 'lastMonth'
  | '3m'
  | '6m'
  | 'thisYear'
  | 'custom';

export interface ReportDateRangeOption {
  value: ReportDateRangePreset;
  label: string;
}

export const REPORT_DATE_RANGE_OPTIONS: ReportDateRangeOption[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

export interface ReportDateRange {
  preset: ReportDateRangePreset;
  // Inclusive lower bound.
  start: Date;
  // Exclusive upper bound -- a row belongs to this range iff
  // start <= rowDate < end. Using an exclusive end (rather than an
  // inclusive end-of-day) avoids millisecond/timezone off-by-one bugs at
  // the boundary entirely.
  end: Date;
  label: string;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function startOfMonth(d: Date, monthOffset = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
}

function startOfYear(d: Date, yearOffset = 0): Date {
  return new Date(d.getFullYear() + yearOffset, 0, 1);
}

// The "now" boundary every rolling range (today/7d/30d/3m/6m) uses as its
// exclusive end -- start of tomorrow, so a range always includes every
// moment of "today so far" without ever reaching into the future.
function tomorrow(now: Date): Date {
  return addDays(startOfDay(now), 1);
}

export function getReportDateRangeLabel(preset: ReportDateRangePreset): string {
  return REPORT_DATE_RANGE_OPTIONS.find((o) => o.value === preset)?.label ?? 'Custom Range';
}

// `custom` is required (and only meaningful) when preset === 'custom'. Any
// other preset ignores it -- there's no way for the caller to accidentally
// request an inconsistent range.
export function resolveReportDateRange(
  preset: ReportDateRangePreset,
  now: Date = new Date(),
  custom?: { start: Date; end: Date }
): ReportDateRange {
  const label = getReportDateRangeLabel(preset);
  switch (preset) {
    case 'today':
      return { preset, start: startOfDay(now), end: tomorrow(now), label };
    case '7d':
      return { preset, start: addDays(startOfDay(now), -6), end: tomorrow(now), label };
    case '30d':
      return { preset, start: addDays(startOfDay(now), -29), end: tomorrow(now), label };
    case '3m':
      return { preset, start: startOfMonth(now, -2), end: tomorrow(now), label };
    case '6m':
      return { preset, start: startOfMonth(now, -5), end: tomorrow(now), label };
    case 'thisMonth':
      return { preset, start: startOfMonth(now), end: startOfMonth(now, 1), label };
    case 'lastMonth':
      return { preset, start: startOfMonth(now, -1), end: startOfMonth(now), label };
    case 'thisYear':
      return { preset, start: startOfYear(now), end: startOfYear(now, 1), label };
    case 'custom': {
      // A malformed/missing custom range (start >= end, or simply omitted)
      // is never trusted to produce a report silently over the wrong
      // window -- fail toward the smallest safe default (today) rather
      // than an empty or backwards range.
      if (!custom || custom.start.getTime() >= custom.end.getTime()) {
        return { preset, start: startOfDay(now), end: tomorrow(now), label };
      }
      return { preset, start: custom.start, end: custom.end, label };
    }
  }
}

// The immediately-preceding period of the same length, for "+12.4% vs
// previous period" comparisons -- e.g. This Month's previous period is
// Last Month (not just "30 days before"), so calendar-anchored presets
// compare against the real preceding calendar unit rather than an
// arbitrary same-duration shift that could land mid-month.
export function getPreviousReportDateRange(range: ReportDateRange): ReportDateRange {
  switch (range.preset) {
    case 'thisMonth': {
      const start = startOfMonth(range.start, -1);
      return { preset: 'lastMonth', start, end: range.start, label: 'previous period' };
    }
    case 'lastMonth': {
      const start = startOfMonth(range.start, -1);
      return { preset: 'lastMonth', start, end: range.start, label: 'previous period' };
    }
    case 'thisYear': {
      const start = startOfYear(range.start, -1);
      return { preset: 'thisYear', start, end: range.start, label: 'previous period' };
    }
    default: {
      // Rolling windows (today/7d/30d/3m/6m) and custom ranges: the
      // immediately-preceding window of the exact same duration.
      const durationMs = range.end.getTime() - range.start.getTime();
      const end = range.start;
      const start = new Date(end.getTime() - durationMs);
      return { preset: range.preset, start, end, label: 'previous period' };
    }
  }
}

export function isDateInRange(iso: string, range: ReportDateRange): boolean {
  const t = new Date(iso).getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}
