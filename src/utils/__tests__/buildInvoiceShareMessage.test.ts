import { buildInvoiceShareMessage } from '../buildInvoiceShareMessage';
import type { PaymentRequest, Profile } from '../../types';

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
};

const profile: Profile = {
  usageType: 'business',
  displayName: 'Farhan Z.',
  businessName: 'THINXIFY',
  country: 'United Arab Emirates',
  website: undefined,
  onboardingCompleted: true,
};

describe('buildInvoiceShareMessage', () => {
  it('includes the invoice ID, business name, amount, description, and payment link', () => {
    const message = buildInvoiceShareMessage(request, profile);

    expect(message).toContain('Invoice INV-SP-A82KD');
    expect(message).toContain('THINXIFY requested 750 USDC for Website Development.');
    expect(message).toContain('Pay with Spero:');
    expect(message).toContain(request.paymentLink);
  });

  it('falls back to the display name when there is no business name', () => {
    const message = buildInvoiceShareMessage(request, { ...profile, businessName: undefined });
    expect(message).toContain('Farhan Z. requested 750 USDC');
  });

  it('omits the description clause when the request has none', () => {
    const message = buildInvoiceShareMessage({ ...request, description: undefined }, profile);
    expect(message).toContain('THINXIFY requested 750 USDC.');
  });
});
