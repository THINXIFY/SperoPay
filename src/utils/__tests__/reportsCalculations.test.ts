import {
  getReportsSummary,
  getPaymentsReportRows,
  getRevenueSeries,
  pickRevenueGranularity,
  getOutstandingSummary,
  getOutstandingReportRows,
  getCustomerReportRows,
  getRequestsReportBreakdown,
  getTransactionsReportRows,
  filterRowsByCustomer,
  filterRowsByAmountRange,
} from '../reportsCalculations';
import { resolveReportDateRange, getPreviousReportDateRange } from '../reportDateRange';
import type { Customer, PaymentRequest, Transaction } from '../../types';

const NOW = new Date(2026, 2, 15, 12, 0, 0); // 2026-03-15

function makeRequest(overrides: Partial<PaymentRequest> & { id: string }): PaymentRequest {
  return {
    paymentCode: `SP-${overrides.id}`,
    amount: 100,
    currency: 'USDC',
    network: 'Solana',
    expiryOption: '7d',
    expiresAt: null,
    status: 'pending',
    createdAt: new Date(2026, 2, 10).toISOString(),
    paymentLink: '',
    publicToken: `token-${overrides.id}`,
    solanaReference: null,
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction> & { id: string; requestId: string }): Transaction {
  return {
    amount: 100,
    currency: 'USDC',
    network: 'Solana',
    fromCustomerId: 'cust-1',
    txHash: `tx-${overrides.id}`,
    paidAt: new Date(2026, 2, 12).toISOString(),
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<Customer> & { id: string; name: string }): Customer {
  return { email: `${overrides.id}@example.com`, avatarColor: 'blue', ...overrides };
}

describe('getReportsSummary', () => {
  it('counts only verified transactions within the range as received revenue', () => {
    const requests = [makeRequest({ id: 'r1', status: 'paid' })];
    const transactions = [
      makeTransaction({ id: 't1', requestId: 'r1', amount: 100, paidAt: new Date(2026, 2, 12).toISOString() }),
      // Outside the range -- must not be counted.
      makeTransaction({ id: 't2', requestId: 'r1', amount: 50, paidAt: new Date(2026, 0, 1).toISOString() }),
    ];
    const range = resolveReportDateRange('thisMonth', NOW);
    const previousRange = getPreviousReportDateRange(range);
    const summary = getReportsSummary(transactions, requests, range, previousRange, NOW);
    expect(summary.totalReceived).toBe(100);
    expect(summary.paymentsCount).toBe(1);
  });

  it('does not count a pending request as revenue', () => {
    const requests = [makeRequest({ id: 'r1', status: 'pending', amount: 500 })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const previousRange = getPreviousReportDateRange(range);
    const summary = getReportsSummary([], requests, range, previousRange, NOW);
    expect(summary.totalReceived).toBe(0);
  });

  it('does not count a cancelled request as revenue or outstanding', () => {
    const requests = [makeRequest({ id: 'r1', status: 'cancelled', amount: 500 })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const previousRange = getPreviousReportDateRange(range);
    const summary = getReportsSummary([], requests, range, previousRange, NOW);
    expect(summary.totalReceived).toBe(0);
    expect(summary.outstanding).toBe(0);
  });

  it('a failed/absent transaction contributes nothing -- only real transaction rows count', () => {
    // No transaction rows at all for this request -- simulates a payment
    // attempt that never actually verified on-chain.
    const requests = [makeRequest({ id: 'r1', status: 'pending', amount: 500 })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const previousRange = getPreviousReportDateRange(range);
    const summary = getReportsSummary([], requests, range, previousRange, NOW);
    expect(summary.totalReceived).toBe(0);
    expect(summary.outstanding).toBe(500);
  });

  it('outstanding reflects the REMAINING amount for a partially paid request, not the original amount', () => {
    const requests = [makeRequest({ id: 'r1', status: 'pending', amount: 1000, allowPartialPayments: true })];
    const transactions = [makeTransaction({ id: 't1', requestId: 'r1', amount: 400, paidAt: new Date(2026, 2, 12).toISOString() })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const previousRange = getPreviousReportDateRange(range);
    const summary = getReportsSummary(transactions, requests, range, previousRange, NOW);
    expect(summary.outstanding).toBe(600);
  });

  it('computes changePercent against the previous period, null when the previous period was zero', () => {
    const requests = [makeRequest({ id: 'r1', status: 'paid' })];
    const transactions = [makeTransaction({ id: 't1', requestId: 'r1', amount: 200, paidAt: new Date(2026, 2, 12).toISOString() })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const previousRange = getPreviousReportDateRange(range);
    const zeroPrevious = getReportsSummary(transactions, requests, range, previousRange, NOW);
    expect(zeroPrevious.changePercent).toBeNull();

    const withPrevious = [
      ...transactions,
      makeTransaction({ id: 't2', requestId: 'r1', amount: 100, paidAt: new Date(2026, 1, 12).toISOString() }),
    ];
    const summary = getReportsSummary(withPrevious, requests, range, previousRange, NOW);
    expect(summary.changePercent).toBe(100); // 200 vs 100 = +100%
  });

  it('averagePayment is totalReceived divided by paymentsCount, 0 when there are no payments', () => {
    const range = resolveReportDateRange('thisMonth', NOW);
    const previousRange = getPreviousReportDateRange(range);
    const empty = getReportsSummary([], [], range, previousRange, NOW);
    expect(empty.averagePayment).toBe(0);

    const requests = [makeRequest({ id: 'r1', status: 'paid' })];
    const transactions = [
      makeTransaction({ id: 't1', requestId: 'r1', amount: 100, paidAt: new Date(2026, 2, 5).toISOString() }),
      makeTransaction({ id: 't2', requestId: 'r1', amount: 300, paidAt: new Date(2026, 2, 10).toISOString() }),
    ];
    const summary = getReportsSummary(transactions, requests, range, previousRange, NOW);
    expect(summary.averagePayment).toBe(200);
  });

  it('overdueCount only counts pending (not confirming) requests past expiry', () => {
    const requests = [
      makeRequest({ id: 'r1', status: 'pending', expiresAt: new Date(2026, 2, 1).toISOString() }), // overdue
      makeRequest({ id: 'r2', status: 'confirming', expiresAt: new Date(2026, 2, 1).toISOString() }), // not overdue: already confirming
      makeRequest({ id: 'r3', status: 'pending', expiresAt: new Date(2026, 3, 1).toISOString() }), // not yet expired
    ];
    const range = resolveReportDateRange('thisMonth', NOW);
    const previousRange = getPreviousReportDateRange(range);
    const summary = getReportsSummary([], requests, range, previousRange, NOW);
    expect(summary.overdueCount).toBe(1);
  });
});

describe('getPaymentsReportRows', () => {
  it('joins customer and request info and marks partial contributions', () => {
    const customers = [makeCustomer({ id: 'cust-1', name: 'Alex Morgan' })];
    const requests = [makeRequest({ id: 'r1', amount: 1000, allowPartialPayments: true, status: 'pending', customerId: 'cust-1' })];
    const transactions = [makeTransaction({ id: 't1', requestId: 'r1', amount: 400, fromCustomerId: 'cust-1', paidAt: new Date(2026, 2, 12).toISOString() })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const rows = getPaymentsReportRows(transactions, requests, customers, range);
    expect(rows).toHaveLength(1);
    expect(rows[0].customerName).toBe('Alex Morgan');
    expect(rows[0].isPartialContribution).toBe(true);
  });

  it('excludes transactions outside the selected range', () => {
    const requests = [makeRequest({ id: 'r1', status: 'paid' })];
    const transactions = [makeTransaction({ id: 't1', requestId: 'r1', paidAt: new Date(2025, 0, 1).toISOString() })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const rows = getPaymentsReportRows(transactions, requests, [], range);
    expect(rows).toHaveLength(0);
  });

  it('falls back gracefully for a transaction whose customer no longer exists', () => {
    const requests = [makeRequest({ id: 'r1', status: 'paid', customerId: 'gone' })];
    const transactions = [makeTransaction({ id: 't1', requestId: 'r1', fromCustomerId: 'gone', paidAt: new Date(2026, 2, 12).toISOString() })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const rows = getPaymentsReportRows(transactions, requests, [], range);
    expect(rows[0].customerName).toBe('Former customer');
  });
});

describe('pickRevenueGranularity / getRevenueSeries', () => {
  it('picks daily buckets for a short range and sums real transactions per bucket', () => {
    const range = resolveReportDateRange('7d', NOW);
    expect(pickRevenueGranularity(range)).toBe('day');
    const transactions = [makeTransaction({ id: 't1', requestId: 'r1', amount: 50, paidAt: new Date(2026, 2, 15, 9).toISOString() })];
    const series = getRevenueSeries(transactions, range, 'day');
    const total = series.reduce((sum, p) => sum + p.value, 0);
    expect(total).toBe(50);
    expect(series.length).toBe(7);
  });

  it('picks monthly buckets for a long range', () => {
    const range = resolveReportDateRange('thisYear', NOW);
    expect(pickRevenueGranularity(range)).toBe('month');
  });

  it('never counts a transaction outside the report range even if it falls in an edge bucket', () => {
    const range = resolveReportDateRange('30d', NOW);
    const transactions = [makeTransaction({ id: 't1', requestId: 'r1', amount: 999, paidAt: new Date(2020, 0, 1).toISOString() })];
    const series = getRevenueSeries(transactions, range, 'day');
    expect(series.reduce((sum, p) => sum + p.value, 0)).toBe(0);
  });
});

describe('getOutstandingSummary / getOutstandingReportRows', () => {
  it('excludes cancelled and paid requests entirely', () => {
    const requests = [
      makeRequest({ id: 'r1', status: 'cancelled', amount: 500 }),
      makeRequest({ id: 'r2', status: 'paid', amount: 500 }),
    ];
    const summary = getOutstandingSummary(requests, [], NOW);
    expect(summary.totalOutstanding).toBe(0);
  });

  it('classifies a plain pending request (no payment yet, not expired) as "pending"', () => {
    const requests = [makeRequest({ id: 'r1', status: 'pending', amount: 300, expiresAt: new Date(2026, 3, 1).toISOString() })];
    const summary = getOutstandingSummary(requests, [], NOW);
    expect(summary.pendingAmount).toBe(300);
    expect(summary.pendingCount).toBe(1);
    expect(summary.overdueAmount).toBe(0);
    expect(summary.partiallyPaidAmount).toBe(0);
  });

  it('classifies an expired-but-still-pending request as "overdue", using the remaining amount', () => {
    const requests = [makeRequest({ id: 'r1', status: 'pending', amount: 300, expiresAt: new Date(2026, 2, 1).toISOString() })];
    const summary = getOutstandingSummary(requests, [], NOW);
    expect(summary.overdueAmount).toBe(300);
    expect(summary.overdueCount).toBe(1);
    expect(summary.pendingAmount).toBe(0);
  });

  it('classifies a request with a partial payment as "partiallyPaid" using the remaining balance, and the three buckets sum to the total with no double-counting', () => {
    const requests = [
      makeRequest({ id: 'r1', status: 'pending', amount: 1000, allowPartialPayments: true, expiresAt: new Date(2026, 3, 1).toISOString() }),
      makeRequest({ id: 'r2', status: 'pending', amount: 200, expiresAt: new Date(2026, 3, 1).toISOString() }),
      makeRequest({ id: 'r3', status: 'pending', amount: 150, expiresAt: new Date(2026, 2, 1).toISOString() }),
    ];
    const transactions = [makeTransaction({ id: 't1', requestId: 'r1', amount: 400, paidAt: new Date(2026, 2, 12).toISOString() })];
    const summary = getOutstandingSummary(requests, transactions, NOW);
    expect(summary.partiallyPaidAmount).toBe(600); // 1000 - 400
    expect(summary.partiallyPaidCount).toBe(1);
    expect(summary.pendingAmount).toBe(200);
    expect(summary.overdueAmount).toBe(150);
    expect(summary.totalOutstanding).toBe(600 + 200 + 150);
  });

  it('a fully-paid-off request never appears in outstanding rows even if allowPartialPayments is true', () => {
    const requests = [makeRequest({ id: 'r1', status: 'paid', amount: 100, allowPartialPayments: true })];
    const transactions = [makeTransaction({ id: 't1', requestId: 'r1', amount: 100 })];
    const rows = getOutstandingReportRows(requests, transactions, [], NOW);
    expect(rows).toHaveLength(0);
  });

  it('report rows expose original/paid/remaining amounts correctly for a partial payment', () => {
    const requests = [makeRequest({ id: 'r1', status: 'pending', amount: 1000, allowPartialPayments: true, expiresAt: new Date(2026, 3, 1).toISOString() })];
    const transactions = [makeTransaction({ id: 't1', requestId: 'r1', amount: 400 })];
    const rows = getOutstandingReportRows(requests, transactions, [], NOW);
    expect(rows[0]).toMatchObject({ originalAmount: 1000, paidAmount: 400, remainingAmount: 600, bucket: 'partiallyPaid' });
  });
});

describe('getCustomerReportRows', () => {
  const customers = [makeCustomer({ id: 'cust-1', name: 'Alex Morgan' }), makeCustomer({ id: 'cust-2', name: 'Jamie Lee' })];

  it('sums totalReceived only from transactions within the selected range, per customer', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', status: 'paid' }),
      makeRequest({ id: 'r2', customerId: 'cust-2', status: 'paid' }),
    ];
    const transactions = [
      makeTransaction({ id: 't1', requestId: 'r1', fromCustomerId: 'cust-1', amount: 300, paidAt: new Date(2026, 2, 10).toISOString() }),
      makeTransaction({ id: 't2', requestId: 'r2', fromCustomerId: 'cust-2', amount: 999, paidAt: new Date(2025, 0, 1).toISOString() }),
    ];
    const range = resolveReportDateRange('thisMonth', NOW);
    const rows = getCustomerReportRows(customers, transactions, requests, range, 'revenue');
    const alex = rows.find((r) => r.customerId === 'cust-1');
    const jamie = rows.find((r) => r.customerId === 'cust-2');
    expect(alex?.totalReceived).toBe(300);
    expect(jamie?.totalReceived).toBe(0); // out-of-range payment doesn't count for this period
  });

  it('outstanding is a current snapshot (not range-limited) using remaining amounts', () => {
    const requests = [makeRequest({ id: 'r1', customerId: 'cust-1', status: 'pending', amount: 1000, allowPartialPayments: true })];
    const transactions = [makeTransaction({ id: 't1', requestId: 'r1', fromCustomerId: 'cust-1', amount: 250, paidAt: new Date(2020, 0, 1).toISOString() })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const rows = getCustomerReportRows(customers, transactions, requests, range, 'revenue');
    expect(rows.find((r) => r.customerId === 'cust-1')?.outstanding).toBe(750);
  });

  it('excludes customers who have never had any request at all', () => {
    const inactiveCustomer = makeCustomer({ id: 'cust-3', name: 'Never Active' });
    const requests = [makeRequest({ id: 'r1', customerId: 'cust-1', status: 'paid' })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const rows = getCustomerReportRows([...customers, inactiveCustomer], [], requests, range, 'revenue');
    expect(rows.some((r) => r.customerId === 'cust-3')).toBe(false);
  });

  it('sorts by highest revenue by default', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', status: 'paid' }),
      makeRequest({ id: 'r2', customerId: 'cust-2', status: 'paid' }),
    ];
    const transactions = [
      makeTransaction({ id: 't1', requestId: 'r1', fromCustomerId: 'cust-1', amount: 100, paidAt: new Date(2026, 2, 10).toISOString() }),
      makeTransaction({ id: 't2', requestId: 'r2', fromCustomerId: 'cust-2', amount: 500, paidAt: new Date(2026, 2, 10).toISOString() }),
    ];
    const range = resolveReportDateRange('thisMonth', NOW);
    const rows = getCustomerReportRows(customers, transactions, requests, range, 'revenue');
    expect(rows[0].customerId).toBe('cust-2');
  });

  it('sorts by most payments when requested', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', status: 'paid' }),
      makeRequest({ id: 'r2', customerId: 'cust-2', status: 'paid' }),
    ];
    const transactions = [
      makeTransaction({ id: 't1', requestId: 'r1', fromCustomerId: 'cust-1', amount: 900, paidAt: new Date(2026, 2, 10).toISOString() }),
      makeTransaction({ id: 't2', requestId: 'r2', fromCustomerId: 'cust-2', amount: 10, paidAt: new Date(2026, 2, 10).toISOString() }),
      makeTransaction({ id: 't3', requestId: 'r2', fromCustomerId: 'cust-2', amount: 10, paidAt: new Date(2026, 2, 11).toISOString() }),
    ];
    const range = resolveReportDateRange('thisMonth', NOW);
    const rows = getCustomerReportRows(customers, transactions, requests, range, 'payments');
    expect(rows[0].customerId).toBe('cust-2');
  });
});

describe('getRequestsReportBreakdown', () => {
  it('buckets are mutually exclusive and always sum to created', () => {
    const requests = [
      makeRequest({ id: 'r1', status: 'paid' }),
      makeRequest({ id: 'r2', status: 'cancelled' }),
      makeRequest({ id: 'r3', status: 'pending', expiresAt: new Date(2026, 2, 1).toISOString() }), // expired
      makeRequest({ id: 'r4', status: 'pending', amount: 1000, allowPartialPayments: true }), // partially paid
      makeRequest({ id: 'r5', status: 'pending' }), // plain pending
    ];
    const transactions = [makeTransaction({ id: 't1', requestId: 'r4', amount: 200 })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const breakdown = getRequestsReportBreakdown(requests, transactions, range, NOW);
    expect(breakdown).toEqual({ created: 5, paid: 1, cancelled: 1, expired: 1, partiallyPaid: 1, pending: 1 });
  });

  it('only counts requests created within the selected range', () => {
    const requests = [makeRequest({ id: 'r1', status: 'paid', createdAt: new Date(2020, 0, 1).toISOString() })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const breakdown = getRequestsReportBreakdown(requests, [], range, NOW);
    expect(breakdown.created).toBe(0);
  });
});

describe('filterRowsByCustomer / filterRowsByAmountRange', () => {
  const rows = [
    { customerId: 'a', amount: 50 },
    { customerId: 'b', amount: 500 },
    { customerId: 'a', amount: 5000 },
  ];

  it('filterRowsByCustomer returns all rows when no customer is selected', () => {
    expect(filterRowsByCustomer(rows, null)).toHaveLength(3);
  });

  it('filterRowsByCustomer narrows to only that customer', () => {
    expect(filterRowsByCustomer(rows, 'a')).toHaveLength(2);
  });

  it('filterRowsByAmountRange applies an inclusive min and max', () => {
    expect(filterRowsByAmountRange(rows, 100, 1000)).toEqual([{ customerId: 'b', amount: 500 }]);
  });

  it('filterRowsByAmountRange with only a min set has no upper bound', () => {
    expect(filterRowsByAmountRange(rows, 500, null)).toHaveLength(2);
  });
});

describe('getTransactionsReportRows', () => {
  it('every row is labeled Confirmed -- a Transaction row only exists once verified', () => {
    const requests = [makeRequest({ id: 'r1', status: 'paid' })];
    const transactions = [makeTransaction({ id: 't1', requestId: 'r1', paidAt: new Date(2026, 2, 12).toISOString() })];
    const range = resolveReportDateRange('thisMonth', NOW);
    const rows = getTransactionsReportRows(transactions, requests, [], range);
    expect(rows[0].status).toBe('Confirmed');
    expect(rows[0].txHash).toBe('tx-t1');
  });

  it('sorts newest first', () => {
    const requests = [makeRequest({ id: 'r1', status: 'paid' })];
    const transactions = [
      makeTransaction({ id: 't1', requestId: 'r1', paidAt: new Date(2026, 2, 5).toISOString() }),
      makeTransaction({ id: 't2', requestId: 'r1', paidAt: new Date(2026, 2, 12).toISOString() }),
    ];
    const range = resolveReportDateRange('thisMonth', NOW);
    const rows = getTransactionsReportRows(transactions, requests, [], range);
    expect(rows[0].transactionId).toBe('t2');
  });
});
