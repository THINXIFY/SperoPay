import { getDateLabel } from '../getDateLabel';
import type { PaymentRequest, Transaction } from '../../types';

function makeRequest(overrides: Partial<PaymentRequest>): PaymentRequest {
  return {
    id: 'req-test',
    paymentCode: 'SP-A82KD',
    amount: 750,
    currency: 'USDC',
    network: 'Solana',
    description: 'Website Development',
    customerId: 'cust-1',
    expiryOption: '7d',
    expiresAt: null,
    status: 'pending',
    createdAt: '2026-08-10T12:00:00.000Z',
    paymentLink: 'https://pay.speropay.app/r/req-test',
    publicToken: 'test-public-token-1',
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'txn-req-test',
    requestId: 'req-test',
    amount: 750,
    currency: 'USDC',
    network: 'Solana',
    fromCustomerId: 'cust-1',
    txHash: '5LwYkP2vX9mT4qR8jH3nD7fC1sB6uA0oE5wZyN9KxP',
    paidAt: '2026-08-14T12:00:00.000Z',
    ...overrides,
  };
}

describe('getDateLabel paid requests', () => {
  it('uses the transactions paidAt, not the requests createdAt', () => {
    const request = makeRequest({ status: 'paid', createdAt: '2026-08-10T12:00:00.000Z' });
    const transaction = makeTransaction({ paidAt: '2026-08-14T12:00:00.000Z' });

    expect(getDateLabel(request, transaction)).toBe('Paid on Aug 14, 2026');
  });

  it('falls back to createdAt when no transaction is passed', () => {
    const request = makeRequest({ status: 'paid', createdAt: '2026-08-10T12:00:00.000Z' });

    expect(getDateLabel(request)).toBe('Paid on Aug 10, 2026');
  });
});

describe('getDateLabel non-paid requests are unaffected by the transaction param', () => {
  it('a pending request with no expiry still returns No expiry', () => {
    const request = makeRequest({ status: 'pending', expiresAt: null });

    expect(getDateLabel(request)).toBe('No expiry');
    expect(getDateLabel(request, makeTransaction({}))).toBe('No expiry');
  });

  it('a pending request with an expiry still counts down the days left', () => {
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const request = makeRequest({ status: 'pending', expiresAt });

    expect(getDateLabel(request)).toBe('Expires in 3d');
    expect(getDateLabel(request, makeTransaction({}))).toBe('Expires in 3d');
  });

  it('a confirming request still returns the confirming label', () => {
    const request = makeRequest({ status: 'confirming' });

    expect(getDateLabel(request)).toBe('Confirming payment…');
    expect(getDateLabel(request, makeTransaction({}))).toBe('Confirming payment…');
  });

  it('a cancelled request still returns Cancelled', () => {
    const request = makeRequest({ status: 'cancelled' });

    expect(getDateLabel(request)).toBe('Cancelled');
    expect(getDateLabel(request, makeTransaction({}))).toBe('Cancelled');
  });

  it('an expired request still uses its expiresAt', () => {
    const request = makeRequest({ status: 'expired', expiresAt: '2026-05-18T12:00:00.000Z' });

    expect(getDateLabel(request)).toBe('Expired on May 18, 2026');
    expect(getDateLabel(request, makeTransaction({}))).toBe('Expired on May 18, 2026');
  });

  it('an expired request with no expiresAt falls back to createdAt', () => {
    const request = makeRequest({ status: 'expired', expiresAt: null, createdAt: '2026-05-11T12:00:00.000Z' });

    expect(getDateLabel(request)).toBe('Expired on May 11, 2026');
    expect(getDateLabel(request, makeTransaction({}))).toBe('Expired on May 11, 2026');
  });
});
