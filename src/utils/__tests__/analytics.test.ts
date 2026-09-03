import {
  getRevenueSummary,
  getOutstandingSummary,
  getAvgPaymentTimeSummary,
  getPaymentOverview,
  getTopCustomers,
  getRevenueTrend,
} from '../analytics';
import type { PaymentRequest, Transaction } from '../../types';

const NOW = new Date('2026-03-15T12:00:00.000Z');

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    requestId: 'req-1',
    amount: 100,
    currency: 'USDC',
    network: 'Solana',
    fromCustomerId: 'cust-1',
    txHash: '0xabc',
    paidAt: NOW.toISOString(),
    ...overrides,
  };
}

function req(overrides: Partial<PaymentRequest>): PaymentRequest {
  return {
    id: 'req-1',
    paymentCode: 'PC-1',
    amount: 100,
    currency: 'USDC',
    network: 'Solana',
    expiryOption: '7d',
    expiresAt: null,
    status: 'pending',
    createdAt: NOW.toISOString(),
    paymentLink: 'https://example.com',
    publicToken: 'token-1',
    solanaReference: null,
    ...overrides,
  };
}

describe('getRevenueSummary', () => {
  it('sums this month and last month separately', () => {
    const transactions = [
      tx({ amount: 100, paidAt: '2026-03-10T00:00:00.000Z' }),
      tx({ amount: 50, paidAt: '2026-03-01T00:00:00.000Z' }),
      tx({ amount: 200, paidAt: '2026-02-20T00:00:00.000Z' }),
    ];
    const result = getRevenueSummary(transactions, NOW);
    expect(result.thisMonth).toBe(150);
    expect(result.lastMonth).toBe(200);
    expect(result.changePercent).toBeCloseTo(-25);
  });

  it('returns null changePercent when last month had zero revenue', () => {
    const transactions = [tx({ amount: 100, paidAt: '2026-03-10T00:00:00.000Z' })];
    const result = getRevenueSummary(transactions, NOW);
    expect(result.lastMonth).toBe(0);
    expect(result.changePercent).toBeNull();
  });

  it('handles a January "now" rolling back into the prior December/year', () => {
    const january = new Date('2026-01-15T00:00:00.000Z');
    const transactions = [tx({ amount: 100, paidAt: '2025-12-20T00:00:00.000Z' })];
    const result = getRevenueSummary(transactions, january);
    expect(result.lastMonth).toBe(100);
  });
});

describe('getOutstandingSummary', () => {
  it('sums pending and confirming requests only', () => {
    const requests = [
      req({ id: 'a', amount: 100, status: 'pending' }),
      req({ id: 'b', amount: 50, status: 'confirming' }),
      req({ id: 'c', amount: 200, status: 'paid' }),
      req({ id: 'd', amount: 30, status: 'cancelled' }),
    ];
    const result = getOutstandingSummary(requests);
    expect(result.amount).toBe(150);
    expect(result.count).toBe(2);
  });
});

describe('getAvgPaymentTimeSummary', () => {
  it('averages days between request creation and payment for this month', () => {
    const requests = [
      req({ id: 'a', createdAt: '2026-03-01T00:00:00.000Z' }),
      req({ id: 'b', createdAt: '2026-03-05T00:00:00.000Z' }),
    ];
    const transactions = [
      tx({ requestId: 'a', paidAt: '2026-03-03T00:00:00.000Z' }), // 2 days
      tx({ requestId: 'b', paidAt: '2026-03-06T00:00:00.000Z' }), // 1 day
    ];
    const result = getAvgPaymentTimeSummary(requests, transactions, NOW);
    expect(result.days).toBeCloseTo(1.5);
  });

  it('returns null with no comparison when there is no paid cohort at all', () => {
    const result = getAvgPaymentTimeSummary([], [], NOW);
    expect(result.days).toBeNull();
    expect(result.isFasterThanLastMonth).toBeNull();
  });

  it('falls back to an all-time average with no comparison when this month has no paid cohort yet', () => {
    const requests = [req({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' })];
    const transactions = [tx({ requestId: 'a', paidAt: '2026-01-03T00:00:00.000Z' })]; // 2 days, in January
    const result = getAvgPaymentTimeSummary(requests, transactions, NOW); // NOW is March
    expect(result.days).toBeCloseTo(2);
    expect(result.isFasterThanLastMonth).toBeNull();
  });

  it('flags faster/slower correctly against last month', () => {
    const requests = [
      req({ id: 'a', createdAt: '2026-03-01T00:00:00.000Z' }),
      req({ id: 'b', createdAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const transactions = [
      tx({ requestId: 'a', paidAt: '2026-03-02T00:00:00.000Z' }), // 1 day this month
      tx({ requestId: 'b', paidAt: '2026-02-05T00:00:00.000Z' }), // 4 days last month
    ];
    const result = getAvgPaymentTimeSummary(requests, transactions, NOW);
    expect(result.isFasterThanLastMonth).toBe(true);
  });
});

describe('getPaymentOverview', () => {
  it('counts paid, outstanding, and overdue (pending + already past expiry) separately', () => {
    const requests = [
      req({ id: 'a', status: 'paid' }),
      req({ id: 'b', status: 'pending', expiresAt: '2026-03-10T00:00:00.000Z' }), // past
      req({ id: 'c', status: 'pending', expiresAt: '2026-04-01T00:00:00.000Z' }), // future
      req({ id: 'd', status: 'confirming', expiresAt: '2026-03-01T00:00:00.000Z' }), // past but confirming -- not overdue
      req({ id: 'e', status: 'cancelled' }),
    ];
    const result = getPaymentOverview(requests, NOW);
    expect(result.paidCount).toBe(1);
    expect(result.outstandingCount).toBe(3); // b, c, d
    expect(result.overdueCount).toBe(1); // only b
  });

  it('never counts a request with no expiry as overdue', () => {
    const requests = [req({ id: 'a', status: 'pending', expiresAt: null })];
    const result = getPaymentOverview(requests, NOW);
    expect(result.overdueCount).toBe(0);
  });
});

describe('getTopCustomers', () => {
  it('ranks customers by total received, descending', () => {
    const transactions = [
      tx({ fromCustomerId: 'cust-a', amount: 100 }),
      tx({ fromCustomerId: 'cust-b', amount: 500 }),
      tx({ fromCustomerId: 'cust-a', amount: 50 }),
    ];
    const result = getTopCustomers(transactions);
    expect(result).toEqual([
      { customerId: 'cust-b', totalReceived: 500, paymentCount: 1 },
      { customerId: 'cust-a', totalReceived: 150, paymentCount: 2 },
    ]);
  });

  it('respects the limit', () => {
    const transactions = ['a', 'b', 'c', 'd'].map((id) => tx({ fromCustomerId: id, amount: 10 }));
    expect(getTopCustomers(transactions, 2)).toHaveLength(2);
  });

  it('ignores transactions with no customer attached', () => {
    const transactions = [tx({ fromCustomerId: '', amount: 100 })];
    expect(getTopCustomers(transactions)).toEqual([]);
  });
});

describe('getRevenueTrend', () => {
  it('produces 7 daily buckets for 7D, each a real sum', () => {
    const transactions = [tx({ amount: 100, paidAt: NOW.toISOString() })];
    const result = getRevenueTrend(transactions, '7D', NOW);
    expect(result).toHaveLength(7);
    expect(result[result.length - 1].value).toBe(100);
    expect(result.slice(0, 6).every((p) => p.value === 0)).toBe(true);
  });

  it('produces 6 monthly buckets for 6M, attributing each transaction to its own calendar month', () => {
    const transactions = [
      tx({ amount: 100, paidAt: '2026-03-10T00:00:00.000Z' }),
      tx({ amount: 50, paidAt: '2026-01-05T00:00:00.000Z' }),
    ];
    const result = getRevenueTrend(transactions, '6M', NOW);
    expect(result).toHaveLength(6);
    expect(result[result.length - 1].label).toBe('Mar');
    expect(result[result.length - 1].value).toBe(100);
    const jan = result.find((p) => p.label === 'Jan');
    expect(jan?.value).toBe(50);
  });

  it('never double-counts a transaction across two buckets', () => {
    const transactions = [tx({ amount: 100, paidAt: NOW.toISOString() })];
    const result = getRevenueTrend(transactions, '30D', NOW);
    const total = result.reduce((sum, p) => sum + p.value, 0);
    expect(total).toBe(100);
  });
});
