import { describeActivityEvent } from '../activityPresentation';
import type { RequestEvent, PaymentRequest, Customer } from '../../types';

const baseRequest: PaymentRequest = {
  id: 'req-1',
  paymentCode: 'SP-AAAAA',
  amount: 250,
  currency: 'USDC',
  network: 'Solana',
  customerId: 'cust-1',
  expiryOption: 'never',
  expiresAt: null,
  status: 'paid',
  createdAt: '2026-09-01T00:00:00.000Z',
  paymentLink: 'https://pay.speropay.app/r/req-1',
  publicToken: 'token-1',
  solanaReference: 'ref-1',
};

const baseCustomer: Customer = {
  id: 'cust-1',
  name: 'A regular customer',
  email: 'customer@example.com',
  avatarColor: 'blue',
};

function event(overrides: Partial<RequestEvent> = {}): RequestEvent {
  return { id: 'evt-1', requestId: 'req-1', type: 'payment_confirmed', occurredAt: '2026-09-10T10:00:00.000Z', ...overrides };
}

describe('describeActivityEvent', () => {
  it('uses business-facing copy for a confirmed payment ("received", not "confirmed")', () => {
    const result = describeActivityEvent(event({ type: 'payment_confirmed' }), baseRequest, baseCustomer);
    expect(result.title).toBe('Payment received');
    expect(result.tone).toBe('success');
    expect(result.description).toContain('250');
    expect(result.description).toContain('USDC');
  });

  it('relabels a "created" event as a recurring request when the request has a recurring plan', () => {
    const recurringRequest: PaymentRequest = { ...baseRequest, recurringPlanId: 'plan-1' };
    const result = describeActivityEvent(event({ type: 'created' }), recurringRequest, baseCustomer);
    expect(result.title).toBe('Recurring request created');
  });

  it('keeps the plain "Request created" title for an ordinary, non-recurring request', () => {
    const result = describeActivityEvent(event({ type: 'created' }), baseRequest, baseCustomer);
    expect(result.title).toBe('Request created');
  });

  it('falls back to "No customer" when the request has none', () => {
    const noCustomerRequest: PaymentRequest = { ...baseRequest, customerId: undefined, description: undefined };
    const result = describeActivityEvent(event(), noCustomerRequest, undefined);
    expect(result.description).toContain('No customer');
  });

  it('prefers the request description over the customer name when both exist', () => {
    const described: PaymentRequest = { ...baseRequest, description: 'Website design' };
    const result = describeActivityEvent(event(), described, baseCustomer);
    expect(result.description).toContain('Website design');
  });

  it('degrades gracefully with no description at all when the request is missing (not yet loaded)', () => {
    const result = describeActivityEvent(event(), undefined, undefined);
    expect(result.description).toBeUndefined();
    expect(result.title).toBe('Payment received');
  });

  it('marks a failure event with a danger tone', () => {
    expect(describeActivityEvent(event({ type: 'reminder_failed' }), baseRequest, baseCustomer).tone).toBe('danger');
    expect(describeActivityEvent(event({ type: 'payment_failed' }), baseRequest, baseCustomer).tone).toBe('danger');
  });
});
