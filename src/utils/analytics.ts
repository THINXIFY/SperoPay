import type { PaymentRequest, Transaction } from '../types';
import { isRequestExpired } from './expiry';
import { computePaymentAccounting } from './paymentAccounting';

// Every "this month" / "last month" split in this file uses the same local
// calendar-month convention already established by home.tsx's
// receivedThisMonth -- getFullYear()/getMonth() equality, not a rolling
// 30-day window. Kept as small local predicates rather than a shared
// dependency on home.tsx, since that screen has no exports of its own.
function isInMonth(iso: string, year: number, month: number): boolean {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month;
}

function monthsAgo(now: Date, n: number): { year: number; month: number } {
  // Date's own month-rollover arithmetic (new Date(y, m - n, 1)) handles
  // negative months by rolling back into prior years, so no manual mod/carry
  // logic is needed here.
  const d = new Date(now.getFullYear(), now.getMonth() - n, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export interface RevenueSummary {
  thisMonth: number;
  lastMonth: number;
  // null when last month had zero revenue -- a percentage change against a
  // zero baseline is not a real number (and "Infinity%" is not honest
  // either), so the UI omits the trend line entirely in that case rather
  // than inventing one.
  changePercent: number | null;
}

export function getRevenueSummary(transactions: Transaction[], now: Date = new Date()): RevenueSummary {
  const current = monthsAgo(now, 0);
  const previous = monthsAgo(now, 1);
  const thisMonth = transactions
    .filter((t) => isInMonth(t.paidAt, current.year, current.month))
    .reduce((sum, t) => sum + t.amount, 0);
  const lastMonth = transactions
    .filter((t) => isInMonth(t.paidAt, previous.year, previous.month))
    .reduce((sum, t) => sum + t.amount, 0);
  const changePercent = lastMonth === 0 ? null : ((thisMonth - lastMonth) / lastMonth) * 100;
  return { thisMonth, lastMonth, changePercent };
}

export interface OutstandingSummary {
  amount: number;
  count: number;
}

// Same "unpaid" definition as getCustomerStats.ts's outstanding field:
// pending or confirming, i.e. every request that hasn't resolved to paid,
// cancelled, or (client-derived) expired yet. The AMOUNT contributed by
// each is its REMAINING balance (computePaymentAccounting), not its
// original `amount` -- a $1,000 request with $400 already verified paid
// contributes $600 here, not $1,000. Before this fix this summed the raw
// request amount, which silently overcounted Outstanding for any
// partially paid request and disagreed with Reports' own (correct)
// figure for the same data -- see reportsCalculations.ts's
// getOutstandingSummary, the source of truth this now matches.
export function getOutstandingSummary(requests: PaymentRequest[], transactions: Transaction[]): OutstandingSummary {
  const unpaid = requests.filter((r) => r.status === 'pending' || r.status === 'confirming');
  const amount = unpaid.reduce((sum, r) => sum + computePaymentAccounting(r, transactions).remainingAmount, 0);
  return { amount, count: unpaid.length };
}

export interface AvgPaymentTimeSummary {
  // null when there is no paid cohort to average at all (a brand-new
  // merchant) -- the UI's empty state covers this, not a fabricated 0.
  days: number | null;
  // null when there's no prior-month cohort to compare against.
  isFasterThanLastMonth: boolean | null;
}

function averagePaymentDays(requests: PaymentRequest[], transactions: Transaction[], predicate: (t: Transaction) => boolean): number | null {
  const requestById = new Map(requests.map((r) => [r.id, r]));
  const samples = transactions
    .filter(predicate)
    .map((t) => {
      const request = requestById.get(t.requestId);
      if (!request) return null;
      const ms = new Date(t.paidAt).getTime() - new Date(request.createdAt).getTime();
      return ms / (1000 * 60 * 60 * 24);
    })
    .filter((days): days is number => days !== null && days >= 0);
  if (samples.length === 0) return null;
  return samples.reduce((sum, d) => sum + d, 0) / samples.length;
}

// Scoped to "paid this calendar month" so it reads as a current-performance
// metric (matching the Revenue hero's own "this month" framing) rather than
// a slow-moving lifetime average. Falls back to an all-time average only
// when this month has no paid cohort yet (e.g. early in a new month) --
// without a comparison, since there's nothing meaningful to compare a
// mixed-period figure against.
export function getAvgPaymentTimeSummary(
  requests: PaymentRequest[],
  transactions: Transaction[],
  now: Date = new Date()
): AvgPaymentTimeSummary {
  const current = monthsAgo(now, 0);
  const previous = monthsAgo(now, 1);
  const thisMonthAvg = averagePaymentDays(requests, transactions, (t) => isInMonth(t.paidAt, current.year, current.month));
  if (thisMonthAvg !== null) {
    const lastMonthAvg = averagePaymentDays(requests, transactions, (t) => isInMonth(t.paidAt, previous.year, previous.month));
    return {
      days: thisMonthAvg,
      isFasterThanLastMonth: lastMonthAvg === null ? null : thisMonthAvg < lastMonthAvg,
    };
  }
  const allTimeAvg = averagePaymentDays(requests, transactions, () => true);
  return { days: allTimeAvg, isFasterThanLastMonth: null };
}

export interface PaymentOverview {
  paidCount: number;
  outstandingCount: number;
  overdueCount: number;
}

// Overdue is a strict, real subset of outstanding: still 'pending' (not yet
// even detected as paying -- a 'confirming' request already has a payment
// in flight, so it isn't meaningfully "overdue") AND past its own
// expires_at, using the same isRequestExpired() the checkout flow itself
// uses to decide payability. This is never a fabricated status -- see
// verify-payment/index.ts's own comment that 'expired' is never actually
// written to payment_requests.status; expiry is a derived, point-in-time
// fact, computed here the same way it's computed everywhere else in this
// codebase that needs it.
export function getPaymentOverview(requests: PaymentRequest[], now: Date = new Date()): PaymentOverview {
  const paidCount = requests.filter((r) => r.status === 'paid').length;
  const outstandingCount = requests.filter((r) => r.status === 'pending' || r.status === 'confirming').length;
  const overdueCount = requests.filter((r) => r.status === 'pending' && isRequestExpired(r, now)).length;
  return { paidCount, outstandingCount, overdueCount };
}

export interface TopCustomer {
  customerId: string;
  totalReceived: number;
  paymentCount: number;
}

// Ranked directly off transactions (each already carries fromCustomerId),
// not by joining back through requests -- simpler and exactly as accurate,
// since every transaction is itself real, verified, paid money.
export function getTopCustomers(transactions: Transaction[], limit = 5): TopCustomer[] {
  const byCustomer = new Map<string, TopCustomer>();
  for (const t of transactions) {
    if (!t.fromCustomerId) continue;
    const existing = byCustomer.get(t.fromCustomerId);
    if (existing) {
      existing.totalReceived += t.amount;
      existing.paymentCount += 1;
    } else {
      byCustomer.set(t.fromCustomerId, { customerId: t.fromCustomerId, totalReceived: t.amount, paymentCount: 1 });
    }
  }
  return Array.from(byCustomer.values())
    .sort((a, b) => b.totalReceived - a.totalReceived)
    .slice(0, limit);
}

export type RevenueTrendPeriod = '7D' | '30D' | '3M' | '6M' | '1Y';

export interface RevenueTrendPoint {
  label: string;
  value: number;
}

const SHORT_WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const SHORT_MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' });

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dailyBuckets(now: Date, days: number, label: (d: Date) => string) {
  const today = startOfDay(now);
  const buckets: { start: Date; end: Date; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    buckets.push({ start, end, label: label(start) });
  }
  return buckets;
}

function weeklyBuckets(now: Date, weeks: number) {
  // Rolling 7-day windows ending "today" (exclusive upper bound at the
  // start of tomorrow) rather than calendar-week-aligned -- for a rolling
  // "last 3 months" view there's no natural week-1 anchor to align to, so a
  // window anchored to the request time itself is the least surprising
  // choice, and it sidesteps ISO-week/locale-week edge cases entirely.
  const end0 = new Date(startOfDay(now).getTime() + 24 * 60 * 60 * 1000);
  const buckets: { start: Date; end: Date; label: string }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(end0.getFullYear(), end0.getMonth(), end0.getDate() - i * 7);
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7);
    buckets.push({ start, end, label: `${SHORT_MONTH.format(start)} ${start.getDate()}` });
  }
  return buckets;
}

function monthlyBuckets(now: Date, months: number) {
  const buckets: { start: Date; end: Date; label: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    buckets.push({ start, end, label: SHORT_MONTH.format(start) });
  }
  return buckets;
}

function buildBuckets(period: RevenueTrendPeriod, now: Date) {
  switch (period) {
    case '7D':
      return dailyBuckets(now, 7, (d) => SHORT_WEEKDAY.format(d));
    case '30D':
      return dailyBuckets(now, 30, (d) => String(d.getDate()));
    case '3M':
      return weeklyBuckets(now, 13);
    case '6M':
      return monthlyBuckets(now, 6);
    case '1Y':
      return monthlyBuckets(now, 12);
  }
}

// Sparse, evenly-ish spaced buckets, not one per real transaction -- a
// premium trend chart reads its shape at a glance, not its exact daily
// noise. Every bucket is a real sum of real paid transactions; an empty
// bucket is a real 0, never interpolated or smoothed away.
export function getRevenueTrend(transactions: Transaction[], period: RevenueTrendPeriod, now: Date = new Date()): RevenueTrendPoint[] {
  const buckets = buildBuckets(period, now);
  return buckets.map((bucket) => ({
    label: bucket.label,
    value: transactions
      .filter((t) => {
        const paidAt = new Date(t.paidAt).getTime();
        return paidAt >= bucket.start.getTime() && paidAt < bucket.end.getTime();
      })
      .reduce((sum, t) => sum + t.amount, 0),
  }));
}
