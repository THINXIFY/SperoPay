import { buildPaymentRequestPayload } from '../buildPaymentRequest';
import { isValidSolanaAddress } from '../../services/blockchain/solana/walletValidation';

describe('buildPaymentRequestPayload', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  it('builds an insert payload with computed fields', () => {
    const payload = buildPaymentRequestPayload(
      {
        amount: 750,
        description: 'Website design service',
        customerId: 'cust-john-doe',
        expiryOption: '7d',
        note: 'Thank you for your business!',
      },
      now
    );

    expect(payload.amount).toBe(750);
    expect(payload.description).toBe('Website design service');
    expect(payload.customerId).toBe('cust-john-doe');
    expect(payload.note).toBe('Thank you for your business!');
    expect(payload.expiresAt).toBe('2026-08-25T12:00:00.000Z');
    expect(payload.paymentCode).toMatch(/^SP-[A-Z0-9]{5}$/);
  });

  it('supports "never" expiry and omits optional fields', () => {
    const payload = buildPaymentRequestPayload({ amount: 320, expiryOption: 'never' }, now);

    expect(payload.expiresAt).toBeNull();
    expect(payload.description).toBeUndefined();
    expect(payload.customerId).toBeUndefined();
    expect(payload.note).toBeUndefined();
  });

  it('builds paymentLink from paymentCode, not a client-generated id', () => {
    const payload = buildPaymentRequestPayload({ amount: 100, expiryOption: '7d' }, now);
    expect(payload.paymentLink).toBe(`https://pay.speropay.app/r/${payload.paymentCode}`);
  });

  it('automatically generates a valid, unique Solana reference with no merchant action required', () => {
    const first = buildPaymentRequestPayload({ amount: 100, expiryOption: '7d' }, now);
    const second = buildPaymentRequestPayload({ amount: 100, expiryOption: '7d' }, now);

    expect(isValidSolanaAddress(first.solanaReference)).toBe(true);
    expect(first.solanaReference).not.toBe(second.solanaReference);
  });
});
