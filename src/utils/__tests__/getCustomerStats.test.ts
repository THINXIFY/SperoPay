import { getCustomerStats } from '../getCustomerStats';
import type { PaymentRequest } from '../../types';

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
    ...overrides,
  };
}

describe('getCustomerStats', () => {
  it('sums paid requests into totalReceived, counts all requests for that customer', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', amount: 500, status: 'paid' }),
      makeRequest({ id: 'r2', customerId: 'cust-1', amount: 250, status: 'pending' }),
      makeRequest({ id: 'r3', customerId: 'cust-2', amount: 999, status: 'paid' }),
    ];

    const stats = getCustomerStats('cust-1', requests);

    expect(stats.totalRequests).toBe(2);
    expect(stats.totalReceived).toBe(500);
    expect(stats.outstanding).toBe(250);
  });

  it('returns zeros for a customer with no requests', () => {
    const stats = getCustomerStats('cust-none', []);
    expect(stats).toEqual({ totalRequests: 0, totalReceived: 0, outstanding: 0 });
  });

  it('excludes cancelled and expired requests from outstanding', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', amount: 100, status: 'cancelled' }),
      makeRequest({ id: 'r2', customerId: 'cust-1', amount: 200, status: 'expired' }),
      makeRequest({ id: 'r3', customerId: 'cust-1', amount: 300, status: 'pending' }),
    ];

    const stats = getCustomerStats('cust-1', requests);

    expect(stats.totalRequests).toBe(3);
    expect(stats.totalReceived).toBe(0);
    expect(stats.outstanding).toBe(300);
  });

  it('includes confirming requests in outstanding, alongside pending', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', amount: 400, status: 'confirming' }),
      makeRequest({ id: 'r2', customerId: 'cust-1', amount: 100, status: 'pending' }),
    ];

    const stats = getCustomerStats('cust-1', requests);

    expect(stats.totalRequests).toBe(2);
    expect(stats.totalReceived).toBe(0);
    expect(stats.outstanding).toBe(500);
  });
});
