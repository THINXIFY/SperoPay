// Phase 6B Reports -- all report math lives here, built entirely on top of
// existing, already-trusted primitives (computePaymentAccounting for exact
// bigint paid/remaining math, isRequestExpired for the app-wide derived-
// expiry rule) rather than re-deriving money logic from scratch. Every
// function here is a pure function over already-loaded store arrays -- no
// I/O, so each is directly unit-testable and safe to call from a useMemo.
//
// Core financial-accuracy rules enforced throughout this file (spec):
//   - A `Transaction` row IS a verified payment -- it is only ever inserted
//     server-side by complete_verified_payment after real on-chain
//     confirmation (see verify-payment/index.ts). Every sum over
//     `transactions` below is therefore real, verified revenue -- pending
//     or cancelled requests are never counted as revenue because they
//     never produce a Transaction row in the first place.
//   - "Outstanding"/"remaining" amounts always go through
//     computePaymentAccounting (exact bigint base-unit math), never a raw
//     `request.amount` sum -- a partially paid request's outstanding
//     balance is its REMAINING amount, not its original amount.
//   - Cancelled requests are excluded from every outstanding calculation.
import type { Customer, PaymentRequest, Transaction } from '../types';
import { computePaymentAccounting } from './paymentAccounting';
import { isRequestExpired } from './expiry';
import { isDateInRange, type ReportDateRange } from './reportDateRange';
import type { AssetSymbol } from '../config/assets';

// ---------------------------------------------------------------------------
// Summary (Reports Home hero + supporting metrics)
// ---------------------------------------------------------------------------

export interface ReportsSummary {
  totalReceived: number;
  previousTotalReceived: number;
  // null when the previous period had zero revenue -- a percentage change
  // against a zero baseline is not a real number, same rule as
  // analytics.ts's getRevenueSummary.
  changePercent: number | null;
  outstanding: number;
  paymentsCount: number;
  averagePayment: number;
  overdueCount: number;
}

export function getReportsSummary(
  transactions: Transaction[],
  requests: PaymentRequest[],
  range: ReportDateRange,
  previousRange: ReportDateRange,
  now: Date = new Date()
): ReportsSummary {
  const inRange = transactions.filter((t) => isDateInRange(t.paidAt, range));
  const inPreviousRange = transactions.filter((t) => isDateInRange(t.paidAt, previousRange));

  const totalReceived = inRange.reduce((sum, t) => sum + t.amount, 0);
  const previousTotalReceived = inPreviousRange.reduce((sum, t) => sum + t.amount, 0);
  const changePercent = previousTotalReceived === 0 ? null : ((totalReceived - previousTotalReceived) / previousTotalReceived) * 100;

  const outstandingRequests = requests.filter((r) => r.status === 'pending' || r.status === 'confirming');
  const outstanding = outstandingRequests.reduce(
    (sum, r) => sum + computePaymentAccounting(r, transactions).remainingAmount,
    0
  );
  const overdueCount = requests.filter((r) => r.status === 'pending' && isRequestExpired(r, now)).length;

  const paymentsCount = inRange.length;
  const averagePayment = paymentsCount === 0 ? 0 : totalReceived / paymentsCount;

  return { totalReceived, previousTotalReceived, changePercent, outstanding, paymentsCount, averagePayment, overdueCount };
}

// ---------------------------------------------------------------------------
// Payments report
// ---------------------------------------------------------------------------

export interface PaymentReportRow {
  transactionId: string;
  requestId: string;
  paymentCode: string;
  description?: string;
  customerId?: string;
  customerName: string;
  amount: number;
  currency: AssetSymbol;
  paidAt: string;
  network: string;
  // Whether this transaction completed its request in full, or was one of
  // several partial contributions -- derived from the request's current
  // accounting, not stored on the transaction itself (see file header).
  isPartialContribution: boolean;
}

export function getPaymentsReportRows(
  transactions: Transaction[],
  requests: PaymentRequest[],
  customers: Customer[],
  range: ReportDateRange
): PaymentReportRow[] {
  const requestById = new Map(requests.map((r) => [r.id, r]));
  const customerById = new Map(customers.map((c) => [c.id, c]));

  return transactions
    .filter((t) => isDateInRange(t.paidAt, range))
    .map((t) => {
      const request = requestById.get(t.requestId);
      const customer = t.fromCustomerId ? customerById.get(t.fromCustomerId) : undefined;
      const accounting = request ? computePaymentAccounting(request, transactions) : null;
      return {
        transactionId: t.id,
        requestId: t.requestId,
        paymentCode: request?.paymentCode ?? '—',
        description: request?.description,
        customerId: t.fromCustomerId || undefined,
        customerName: customer?.name ?? 'Former customer',
        amount: t.amount,
        currency: t.currency,
        paidAt: t.paidAt,
        network: t.network,
        isPartialContribution: accounting ? !accounting.isFullyPaid : false,
      };
    })
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
}

// ---------------------------------------------------------------------------
// Revenue report (chart series over an arbitrary [start, end) range)
// ---------------------------------------------------------------------------

export interface RevenueSeriesPoint {
  label: string;
  value: number;
  bucketStart: string;
}

type RevenueGranularity = 'day' | 'week' | 'month';

// Picked automatically from the range's span so a 1-year report doesn't
// render 365 daily bars and a 3-day report doesn't render one giant monthly
// bucket -- same "sparse, readable buckets" goal as analytics.ts's
// buildBuckets, generalized to an arbitrary start/end instead of a fixed
// enum of lookback periods.
export function pickRevenueGranularity(range: ReportDateRange): RevenueGranularity {
  const days = (range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

const SHORT_WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const SHORT_MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' });

function buildRangeBuckets(
  range: ReportDateRange,
  granularity: RevenueGranularity
): { start: Date; end: Date; label: string }[] {
  const buckets: { start: Date; end: Date; label: string }[] = [];
  const start = range.start;
  const end = range.end;

  if (granularity === 'day') {
    let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor.getTime() < end.getTime()) {
      const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      buckets.push({ start: cursor, end: bucketEnd, label: SHORT_WEEKDAY.format(cursor) });
      cursor = bucketEnd;
    }
  } else if (granularity === 'week') {
    let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor.getTime() < end.getTime()) {
      const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
      buckets.push({ start: cursor, end: bucketEnd, label: `${SHORT_MONTH.format(cursor)} ${cursor.getDate()}` });
      cursor = bucketEnd;
    }
  } else {
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor.getTime() < end.getTime()) {
      const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      buckets.push({ start: cursor, end: bucketEnd, label: SHORT_MONTH.format(cursor) });
      cursor = bucketEnd;
    }
  }
  return buckets;
}

// Every bucket is a real sum of real verified transactions within it -- an
// empty bucket is a real 0, never interpolated (same rule as
// analytics.ts's getRevenueTrend).
export function getRevenueSeries(
  transactions: Transaction[],
  range: ReportDateRange,
  granularity: RevenueGranularity = pickRevenueGranularity(range)
): RevenueSeriesPoint[] {
  const buckets = buildRangeBuckets(range, granularity);
  return buckets.map((bucket) => ({
    label: bucket.label,
    bucketStart: bucket.start.toISOString(),
    value: transactions
      .filter((t) => {
        const paidAt = new Date(t.paidAt).getTime();
        return paidAt >= bucket.start.getTime() && paidAt < bucket.end.getTime() && paidAt >= range.start.getTime() && paidAt < range.end.getTime();
      })
      .reduce((sum, t) => sum + t.amount, 0),
  }));
}

// ---------------------------------------------------------------------------
// Outstanding report
// ---------------------------------------------------------------------------

export interface OutstandingReportRow {
  requestId: string;
  paymentCode: string;
  customerId?: string;
  customerName: string;
  currency: AssetSymbol;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  // Non-overlapping bucket this request is presented under -- see
  // getOutstandingSummary's own comment for why these three are mutually
  // exclusive rather than allowed to overlap.
  bucket: 'overdue' | 'partiallyPaid' | 'pending';
  dueAt: string | null;
}

export interface OutstandingSummary {
  totalOutstanding: number;
  pendingAmount: number;
  pendingCount: number;
  partiallyPaidAmount: number;
  partiallyPaidCount: number;
  overdueAmount: number;
  overdueCount: number;
}

function classifyOutstandingRequest(
  request: PaymentRequest,
  transactions: Transaction[],
  now: Date
): { bucket: OutstandingReportRow['bucket']; accounting: ReturnType<typeof computePaymentAccounting> } {
  const accounting = computePaymentAccounting(request, transactions);
  // Overdue takes priority (a merchant needs to see "this is late" even if
  // a partial payment already came in), then partially paid, then plain
  // pending -- deliberately mutually exclusive so the three sub-totals sum
  // exactly to totalOutstanding with no double-counted amount.
  if (request.status === 'pending' && isRequestExpired(request, now)) {
    return { bucket: 'overdue', accounting };
  }
  if (accounting.isPartiallyPaid) {
    return { bucket: 'partiallyPaid', accounting };
  }
  return { bucket: 'pending', accounting };
}

// Cancelled requests are never outstanding (spec). Paid requests are, by
// definition, not outstanding either. Every remaining pending/confirming
// request's contribution is its REMAINING amount (computePaymentAccounting),
// never its original amount -- the correctness rule this whole report
// exists to get right for partial payments.
export function getOutstandingSummary(requests: PaymentRequest[], transactions: Transaction[], now: Date = new Date()): OutstandingSummary {
  const outstandingRequests = requests.filter((r) => r.status === 'pending' || r.status === 'confirming');

  let pendingAmount = 0;
  let pendingCount = 0;
  let partiallyPaidAmount = 0;
  let partiallyPaidCount = 0;
  let overdueAmount = 0;
  let overdueCount = 0;

  for (const request of outstandingRequests) {
    const { bucket, accounting } = classifyOutstandingRequest(request, transactions, now);
    if (bucket === 'overdue') {
      overdueAmount += accounting.remainingAmount;
      overdueCount += 1;
    } else if (bucket === 'partiallyPaid') {
      partiallyPaidAmount += accounting.remainingAmount;
      partiallyPaidCount += 1;
    } else {
      pendingAmount += accounting.remainingAmount;
      pendingCount += 1;
    }
  }

  return {
    totalOutstanding: pendingAmount + partiallyPaidAmount + overdueAmount,
    pendingAmount,
    pendingCount,
    partiallyPaidAmount,
    partiallyPaidCount,
    overdueAmount,
    overdueCount,
  };
}

export function getOutstandingReportRows(
  requests: PaymentRequest[],
  transactions: Transaction[],
  customers: Customer[],
  now: Date = new Date()
): OutstandingReportRow[] {
  const customerById = new Map(customers.map((c) => [c.id, c]));
  return requests
    .filter((r) => r.status === 'pending' || r.status === 'confirming')
    .map((request) => {
      const { bucket, accounting } = classifyOutstandingRequest(request, transactions, now);
      const customer = request.customerId ? customerById.get(request.customerId) : undefined;
      return {
        requestId: request.id,
        paymentCode: request.paymentCode,
        customerId: request.customerId,
        customerName: customer?.name ?? 'No customer',
        currency: request.currency,
        originalAmount: accounting.totalAmount,
        paidAmount: accounting.verifiedPaidAmount,
        remainingAmount: accounting.remainingAmount,
        bucket,
        dueAt: request.dueAt ?? null,
      };
    })
    .sort((a, b) => b.remainingAmount - a.remainingAmount);
}

// ---------------------------------------------------------------------------
// Customer report
// ---------------------------------------------------------------------------

export type CustomerReportSort = 'revenue' | 'payments' | 'outstanding' | 'recent';

export interface CustomerReportRow {
  customerId: string;
  customerName: string;
  avatarColor: Customer['avatarColor'];
  avatarUrl?: string;
  imageType?: Customer['imageType'];
  totalReceived: number;
  outstanding: number;
  paymentCount: number;
  lastPaymentAt: string | null;
}

export function getCustomerReportRows(
  customers: Customer[],
  transactions: Transaction[],
  requests: PaymentRequest[],
  range: ReportDateRange,
  sortBy: CustomerReportSort = 'revenue'
): CustomerReportRow[] {
  // Only customers who have ever had at least one request -- a
  // just-created contact with no activity at all has nothing to report,
  // but a customer with real history simply shows 0 for a period they
  // happened to be inactive in (a period-dependent vanishing customer list
  // would be more confusing than an honest "0 this period" row).
  const everActiveCustomerIds = new Set(requests.map((r) => r.customerId).filter((id): id is string => Boolean(id)));

  const rows = customers
    .filter((c) => everActiveCustomerIds.has(c.id))
    .map((customer) => {
      const customerTransactions = transactions.filter((t) => t.fromCustomerId === customer.id);
      const inRangeTransactions = customerTransactions.filter((t) => isDateInRange(t.paidAt, range));
      const customerRequests = requests.filter((r) => r.customerId === customer.id && (r.status === 'pending' || r.status === 'confirming'));
      const outstanding = customerRequests.reduce((sum, r) => sum + computePaymentAccounting(r, transactions).remainingAmount, 0);
      const lastPaymentAt = customerTransactions.reduce<string | null>((latest, t) => {
        if (!latest) return t.paidAt;
        return new Date(t.paidAt).getTime() > new Date(latest).getTime() ? t.paidAt : latest;
      }, null);

      const row: CustomerReportRow = {
        customerId: customer.id,
        customerName: customer.name,
        avatarColor: customer.avatarColor,
        avatarUrl: customer.avatarUrl,
        imageType: customer.imageType,
        totalReceived: inRangeTransactions.reduce((sum, t) => sum + t.amount, 0),
        outstanding,
        paymentCount: inRangeTransactions.length,
        lastPaymentAt,
      };
      return row;
    });

  return rows.sort((a, b) => {
    switch (sortBy) {
      case 'payments':
        return b.paymentCount - a.paymentCount;
      case 'outstanding':
        return b.outstanding - a.outstanding;
      case 'recent': {
        const aTime = a.lastPaymentAt ? new Date(a.lastPaymentAt).getTime() : -Infinity;
        const bTime = b.lastPaymentAt ? new Date(b.lastPaymentAt).getTime() : -Infinity;
        return bTime - aTime;
      }
      case 'revenue':
      default:
        return b.totalReceived - a.totalReceived;
    }
  });
}

// ---------------------------------------------------------------------------
// Requests report
// ---------------------------------------------------------------------------

export interface RequestsReportBreakdown {
  created: number;
  paid: number;
  pending: number;
  partiallyPaid: number;
  expired: number;
  cancelled: number;
}

// The five sub-counts are mutually exclusive and exhaustive by
// construction -- they always sum exactly to `created`. 'expired' is never
// read from the stored status column (it's never actually written there,
// see verify-payment/index.ts's own comment) -- always derived via
// isRequestExpired, the same rule used everywhere else in this codebase.
export function getRequestsReportBreakdown(
  requests: PaymentRequest[],
  transactions: Transaction[],
  range: ReportDateRange,
  now: Date = new Date()
): RequestsReportBreakdown {
  const inRange = requests.filter((r) => isDateInRange(r.createdAt, range));

  let paid = 0;
  let cancelled = 0;
  let expired = 0;
  let partiallyPaid = 0;
  let pending = 0;

  for (const request of inRange) {
    if (request.status === 'paid') {
      paid += 1;
    } else if (request.status === 'cancelled') {
      cancelled += 1;
    } else if (isRequestExpired(request, now)) {
      expired += 1;
    } else if (computePaymentAccounting(request, transactions).isPartiallyPaid) {
      partiallyPaid += 1;
    } else {
      pending += 1;
    }
  }

  return { created: inRange.length, paid, pending, partiallyPaid, expired, cancelled };
}

// ---------------------------------------------------------------------------
// Transactions report
// ---------------------------------------------------------------------------

export interface TransactionReportRow {
  transactionId: string;
  paidAt: string;
  customerId?: string;
  customerName: string;
  requestId: string;
  paymentCode: string;
  amount: number;
  currency: string;
  network: string;
  // Every Transaction row is, by construction, an already-verified payment
  // (see file header) -- there is no other state a persisted transaction
  // row can be in, so this is a constant label, not a derived/stored field.
  status: 'Confirmed';
  txHash: string;
}

export function getTransactionsReportRows(
  transactions: Transaction[],
  requests: PaymentRequest[],
  customers: Customer[],
  range: ReportDateRange
): TransactionReportRow[] {
  const requestById = new Map(requests.map((r) => [r.id, r]));
  const customerById = new Map(customers.map((c) => [c.id, c]));

  return transactions
    .filter((t) => isDateInRange(t.paidAt, range))
    .map((t) => {
      const request = requestById.get(t.requestId);
      const customer = t.fromCustomerId ? customerById.get(t.fromCustomerId) : undefined;
      return {
        transactionId: t.id,
        paidAt: t.paidAt,
        customerId: t.fromCustomerId || undefined,
        customerName: customer?.name ?? 'Former customer',
        requestId: t.requestId,
        paymentCode: request?.paymentCode ?? '—',
        amount: t.amount,
        currency: t.currency,
        network: t.network,
        status: 'Confirmed' as const,
        txHash: t.txHash,
      };
    })
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
}

// ---------------------------------------------------------------------------
// Shared row filters (Filters sheet -- Customer, Amount Range)
// ---------------------------------------------------------------------------
// Generic over any report row shape that carries a customerId/amount, so
// Payments/Outstanding/Customers/Transactions rows can all reuse the exact
// same two predicates rather than each screen re-implementing them. Status
// filtering is intentionally NOT generalized here -- each report's "status"
// means something different (a bucket, a partial-vs-full flag, a fixed
// constant), so that filter is applied inline per screen instead.

export function filterRowsByCustomer<T extends { customerId?: string }>(rows: T[], customerId: string | null): T[] {
  if (!customerId) return rows;
  return rows.filter((r) => r.customerId === customerId);
}

export function filterRowsByAmountRange<T extends { amount: number }>(rows: T[], min: number | null, max: number | null): T[] {
  return rows.filter((r) => (min === null || r.amount >= min) && (max === null || r.amount <= max));
}
