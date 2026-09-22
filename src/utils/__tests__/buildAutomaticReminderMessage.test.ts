import { buildAutomaticReminderMessage } from '../buildAutomaticReminderMessage';
import { getPublicPaymentUrl } from '../publicPaymentLink';
import type { PaymentRequest, Customer } from '../../types';

const request: PaymentRequest = {
  id: 'req-1',
  paymentCode: 'SP-A82KD',
  amount: 750,
  currency: 'USDC',
  network: 'Solana',
  description: 'Website Development',
  customerId: 'cust-1',
  expiryOption: '7d',
  expiresAt: null,
  status: 'pending',
  createdAt: '2026-08-18T00:00:00.000Z',
  paymentLink: 'https://pay.speropay.app/r/req-1',
  publicToken: 'test-public-token-1',
  solanaReference: 'test-solana-reference-1',
};

const customer: Customer = {
  id: 'cust-1',
  name: 'John Doe',
  email: 'john@doe.com',
  avatarColor: 'blue',
};

describe('buildAutomaticReminderMessage', () => {
  it('uses a "will be due soon" tone for before_due', () => {
    const message = buildAutomaticReminderMessage('before_due', request, customer);
    expect(message).toContain('Hi John,');
    expect(message).toContain('will be due soon');
    expect(message).toContain('750 USDC');
    expect(message).toContain(getPublicPaymentUrl(request.publicToken));
  });

  it('uses a "due today" tone for on_due', () => {
    const message = buildAutomaticReminderMessage('on_due', request, customer);
    expect(message).toContain('is due today');
  });

  it('uses an "overdue" tone for after_due', () => {
    const message = buildAutomaticReminderMessage('after_due', request, customer);
    expect(message).toContain('now overdue');
  });

  it('falls back to a generic greeting when there is no customer', () => {
    const message = buildAutomaticReminderMessage('on_due', request, undefined);
    expect(message).toContain('Hello,');
    expect(message).not.toContain('Hi ');
  });

  it('omits the description clause when the request has none', () => {
    const message = buildAutomaticReminderMessage('on_due', { ...request, description: undefined }, customer);
    expect(message).toContain('Your payment of 750 USDC is due today');
  });

  describe('when the request is partially paid', () => {
    it('references the remaining balance instead of the full amount', () => {
      const message = buildAutomaticReminderMessage('after_due', request, customer, 450);
      expect(message).toContain('A remaining balance of 450 USDC');
      expect(message).not.toContain('750 USDC');
    });

    it('still uses the correct tone per reminder type', () => {
      expect(buildAutomaticReminderMessage('before_due', request, customer, 450)).toContain('will be due soon');
      expect(buildAutomaticReminderMessage('on_due', request, customer, 450)).toContain('is due today');
      expect(buildAutomaticReminderMessage('after_due', request, customer, 450)).toContain('now overdue');
    });

    it('falls back to the full amount when remainingAmount equals it (never actually partial)', () => {
      const message = buildAutomaticReminderMessage('on_due', request, customer, 750);
      expect(message).toContain('Your payment of 750 USDC');
      expect(message).not.toContain('remaining balance');
    });

    it('falls back to the full amount when remainingAmount is not provided', () => {
      const message = buildAutomaticReminderMessage('on_due', request, customer);
      expect(message).toContain('Your payment of 750 USDC');
    });
  });

  it('never mentions internal IDs or wallet details', () => {
    const message = buildAutomaticReminderMessage('after_due', request, customer);
    expect(message).not.toContain(request.id);
    expect(message).not.toContain(request.paymentCode);
    expect(message).not.toContain(request.solanaReference ?? '__never__');
  });
});
