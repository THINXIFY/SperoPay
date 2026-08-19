import { buildPaymentRequest } from '../buildPaymentRequest';

describe('buildPaymentRequest', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  it('builds a pending request with computed fields', () => {
    const request = buildPaymentRequest(
      {
        amount: 750,
        description: 'Website design service',
        customerId: 'cust-john-doe',
        expiryOption: '7d',
        note: 'Thank you for your business!',
      },
      now
    );

    expect(request.amount).toBe(750);
    expect(request.currency).toBe('USDC');
    expect(request.network).toBe('Solana');
    expect(request.description).toBe('Website design service');
    expect(request.customerId).toBe('cust-john-doe');
    expect(request.note).toBe('Thank you for your business!');
    expect(request.status).toBe('pending');
    expect(request.createdAt).toBe(now.toISOString());
    expect(request.expiresAt).toBe('2026-08-25T12:00:00.000Z');
    expect(request.paymentCode).toMatch(/^SP-[A-Z0-9]{5}$/);
    expect(request.paymentLink).toBe(`https://pay.speropay.app/r/${request.id}`);
    expect(request.id.length).toBeGreaterThan(0);
  });

  it('supports "never" expiry and omits optional fields', () => {
    const request = buildPaymentRequest(
      { amount: 320, expiryOption: 'never' },
      now
    );

    expect(request.expiresAt).toBeNull();
    expect(request.description).toBeUndefined();
    expect(request.customerId).toBeUndefined();
    expect(request.note).toBeUndefined();
  });
});
