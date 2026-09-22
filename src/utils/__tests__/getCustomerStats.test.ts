import { getCustomerStats } from '../getCustomerStats';
import type { PaymentRequest, Transaction } from '../../types';

function makeRequest(overrides: Partial<PaymentRequest>): PaymentRequest {
  return {
    id: 'req-x',
    paymentCode: 'SP-XXXXX',
    amount: 100,
    currency: 'USDC',
    network: 'Solana',
    customerId: 'cust-1',
    expiryOption: '7d',
    expiresAt: null,
    status: 'pending',
    createdAt: '2026-08-18T00:00:00.000Z',
    paymentLink: 'https://pay.speropay.app/r/req-x',
    publicToken: 'test-public-token-1',
    solanaReference: 'test-solana-reference-1',
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction> & { requestId: string }): Transaction {
  return {
    id: `tx-${overrides.requestId}-${Math.random()}`,
    amount: 100,
    currency: 'USDC',
    network: 'Solana',
    fromCustomerId: 'cust-1',
    txHash: '0xabc',
    paidAt: '2026-08-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('getCustomerStats', () => {
  it('sums verified paid requests into totalReceived, counts all requests for that customer', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', amount: 500, status: 'paid' }),
      makeRequest({ id: 'r2', customerId: 'cust-1', amount: 250, status: 'pending' }),
      makeRequest({ id: 'r3', customerId: 'cust-2', amount: 999, status: 'paid' }),
    ];
    const transactions = [makeTransaction({ requestId: 'r1', amount: 500 }), makeTransaction({ requestId: 'r3', amount: 999 })];

    const stats = getCustomerStats('cust-1', requests, transactions);

    expect(stats.totalRequests).toBe(2);
    expect(stats.byCurrency.USDC?.totalReceived).toBe(500);
    expect(stats.byCurrency.USDC?.outstanding).toBe(250);
  });

  it('returns zero requests and no currency buckets for a customer with no requests', () => {
    const stats = getCustomerStats('cust-none', [], []);
    expect(stats).toEqual({ totalRequests: 0, byCurrency: {} });
  });

  it('an unpaid pending request with no transactions contributes 0 received and its full amount outstanding', () => {
    const requests = [makeRequest({ id: 'r1', customerId: 'cust-1', amount: 300, status: 'pending' })];
    const stats = getCustomerStats('cust-1', requests, []);
    expect(stats.byCurrency.USDC?.totalReceived).toBe(0);
    expect(stats.byCurrency.USDC?.outstanding).toBe(300);
  });

  it('a fully paid request contributes its full amount received and 0 outstanding', () => {
    const requests = [makeRequest({ id: 'r1', customerId: 'cust-1', amount: 1000, status: 'paid' })];
    const transactions = [makeTransaction({ requestId: 'r1', amount: 1000 })];
    const stats = getCustomerStats('cust-1', requests, transactions);
    expect(stats.byCurrency.USDC?.totalReceived).toBe(1000);
    expect(stats.byCurrency.USDC?.outstanding).toBe(0);
  });

  it('a partially paid request contributes the amount actually received and the REMAINING balance outstanding, not the original amount (spec example)', () => {
    const requests = [makeRequest({ id: 'r1', customerId: 'cust-1', amount: 1000, status: 'pending', allowPartialPayments: true })];
    const transactions = [makeTransaction({ requestId: 'r1', amount: 400 })];
    const stats = getCustomerStats('cust-1', requests, transactions);
    expect(stats.byCurrency.USDC?.totalReceived).toBe(400);
    expect(stats.byCurrency.USDC?.outstanding).toBe(600);
  });

  it('multiple partial payments against the same request accumulate correctly', () => {
    const requests = [makeRequest({ id: 'r1', customerId: 'cust-1', amount: 1000, status: 'pending', allowPartialPayments: true })];
    const transactions = [
      makeTransaction({ requestId: 'r1', amount: 250, paidAt: '2026-08-18T00:00:00.000Z' }),
      makeTransaction({ requestId: 'r1', amount: 150, paidAt: '2026-08-19T00:00:00.000Z' }),
    ];
    const stats = getCustomerStats('cust-1', requests, transactions);
    expect(stats.byCurrency.USDC?.totalReceived).toBe(400);
    expect(stats.byCurrency.USDC?.outstanding).toBe(600);
  });

  it('excludes cancelled requests from outstanding, but still counts any payment already received before cancellation', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', amount: 100, status: 'cancelled' }),
      makeRequest({ id: 'r2', customerId: 'cust-1', amount: 300, status: 'pending' }),
    ];
    // A partial payment landed on r1 before the merchant cancelled the rest.
    const transactions = [makeTransaction({ requestId: 'r1', amount: 40 })];

    const stats = getCustomerStats('cust-1', requests, transactions);

    expect(stats.totalRequests).toBe(2);
    expect(stats.byCurrency.USDC?.totalReceived).toBe(40);
    expect(stats.byCurrency.USDC?.outstanding).toBe(300);
  });

  it('excludes an expired request from outstanding (defensive -- the stored status column never actually holds "expired" today)', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', amount: 200, status: 'expired' }),
      makeRequest({ id: 'r2', customerId: 'cust-1', amount: 300, status: 'pending' }),
    ];
    const stats = getCustomerStats('cust-1', requests, []);
    expect(stats.totalRequests).toBe(2);
    expect(stats.byCurrency.USDC?.totalReceived).toBe(0);
    expect(stats.byCurrency.USDC?.outstanding).toBe(300);
  });

  it('includes confirming requests in outstanding, alongside pending', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', amount: 400, status: 'confirming' }),
      makeRequest({ id: 'r2', customerId: 'cust-1', amount: 100, status: 'pending' }),
    ];
    const stats = getCustomerStats('cust-1', requests, []);
    expect(stats.totalRequests).toBe(2);
    expect(stats.byCurrency.USDC?.totalReceived).toBe(0);
    expect(stats.byCurrency.USDC?.outstanding).toBe(500);
  });

  it('keeps USDC and EURC requests from the same customer in separate buckets, never combined into one total', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', amount: 1000, currency: 'USDC', status: 'paid' }),
      makeRequest({ id: 'r2', customerId: 'cust-1', amount: 500, currency: 'EURC', status: 'pending' }),
    ];
    const transactions = [makeTransaction({ requestId: 'r1', amount: 1000, currency: 'USDC' })];

    const stats = getCustomerStats('cust-1', requests, transactions);

    expect(stats.totalRequests).toBe(2);
    expect(stats.byCurrency.USDC).toEqual({ totalReceived: 1000, outstanding: 0 });
    expect(stats.byCurrency.EURC).toEqual({ totalReceived: 0, outstanding: 500 });
  });
});
