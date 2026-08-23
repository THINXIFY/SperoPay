import { buildReminderMessage } from '../buildReminderMessage';
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
};

const customer: Customer = {
  id: 'cust-1',
  name: 'John Doe',
  email: 'john@doe.com',
  avatarColor: 'blue',
};

describe('buildReminderMessage', () => {
  it('produces a friendly reminder referencing the customer first name, amount, description, and Spero', () => {
    const message = buildReminderMessage(request, customer);

    expect(message).toContain('Hi John,');
    expect(message).toContain('750 USDC');
    expect(message).toContain('Website Development');
    expect(message).toContain('Spero');
    expect(message).toContain(getPublicPaymentUrl(request.publicToken));
  });

  it('falls back to a generic greeting when there is no customer', () => {
    const message = buildReminderMessage(request, undefined);
    expect(message).toContain('Hi there,');
    expect(message).toContain('750 USDC');
  });

  it('omits the description clause when the request has none', () => {
    const message = buildReminderMessage({ ...request, description: undefined }, customer);
    expect(message).not.toContain('for  is');
    expect(message).toContain('750 USDC payment is still pending');
  });
});
