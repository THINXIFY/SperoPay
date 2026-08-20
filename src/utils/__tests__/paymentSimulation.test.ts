import { canBeginPaymentConfirmation, canCompletePayment, buildTransaction } from '../paymentSimulation';
import type { PaymentRequest } from '../../types';

function makeRequest(overrides: Partial<PaymentRequest>): PaymentRequest {
  return {
    id: 'req-x',
    paymentCode: 'SP-XXXXX',
    amount: 750,
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

describe('canBeginPaymentConfirmation', () => {
  it('is true only for a pending request', () => {
    expect(canBeginPaymentConfirmation(makeRequest({ status: 'pending' }))).toBe(true);
  });

  it('is false for confirming, paid, expired, cancelled, and undefined', () => {
    expect(canBeginPaymentConfirmation(makeRequest({ status: 'confirming' }))).toBe(false);
    expect(canBeginPaymentConfirmation(makeRequest({ status: 'paid' }))).toBe(false);
    expect(canBeginPaymentConfirmation(makeRequest({ status: 'expired' }))).toBe(false);
    expect(canBeginPaymentConfirmation(makeRequest({ status: 'cancelled' }))).toBe(false);
    expect(canBeginPaymentConfirmation(undefined)).toBe(false);
  });

  it('is false for a pending request whose expiresAt has already passed', () => {
    expect(
      canBeginPaymentConfirmation(makeRequest({ status: 'pending', expiresAt: '2020-01-01T00:00:00.000Z' }))
    ).toBe(false);
  });

  it('is true for a pending request whose expiresAt is still in the future', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(canBeginPaymentConfirmation(makeRequest({ status: 'pending', expiresAt: future }))).toBe(true);
  });
});

describe('canCompletePayment', () => {
  it('is true only for a confirming request', () => {
    expect(canCompletePayment(makeRequest({ status: 'confirming' }))).toBe(true);
  });

  it('is false for pending, paid, expired, cancelled, and undefined', () => {
    expect(canCompletePayment(makeRequest({ status: 'pending' }))).toBe(false);
    expect(canCompletePayment(makeRequest({ status: 'paid' }))).toBe(false);
    expect(canCompletePayment(makeRequest({ status: 'expired' }))).toBe(false);
    expect(canCompletePayment(makeRequest({ status: 'cancelled' }))).toBe(false);
    expect(canCompletePayment(undefined)).toBe(false);
  });
});

describe('buildTransaction', () => {
  it('builds a Transaction matching the request amount, currency, network, and customer', () => {
    const request = makeRequest({ id: 'req-1', amount: 750, customerId: 'cust-42' });
    const now = new Date('2026-08-20T12:00:00.000Z');

    const transaction = buildTransaction(request, now);

    expect(transaction.requestId).toBe('req-1');
    expect(transaction.amount).toBe(750);
    expect(transaction.currency).toBe('USDC');
    expect(transaction.network).toBe('Solana');
    expect(transaction.fromCustomerId).toBe('cust-42');
    expect(transaction.paidAt).toBe('2026-08-20T12:00:00.000Z');
    expect(transaction.txHash).toHaveLength(43);
    expect(transaction.id).toEqual(expect.any(String));
  });

  it('falls back to an empty fromCustomerId when the request has no customer', () => {
    const request = makeRequest({ customerId: undefined });
    const transaction = buildTransaction(request);
    expect(transaction.fromCustomerId).toBe('');
  });

  it('produces a unique id and txHash on each call', () => {
    const request = makeRequest({});
    const a = buildTransaction(request);
    const b = buildTransaction(request);
    expect(a.id).not.toBe(b.id);
    expect(a.txHash).not.toBe(b.txHash);
  });
});
