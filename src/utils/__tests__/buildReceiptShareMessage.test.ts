import { buildReceiptShareMessage } from '../buildReceiptShareMessage';
import type { PaymentRequest } from '../../types';

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
  status: 'paid',
  createdAt: '2026-08-18T00:00:00.000Z',
  paymentLink: 'https://pay.speropay.app/r/req-1',
  publicToken: 'test-public-token-1',
};

describe('buildReceiptShareMessage', () => {
  it('includes the receipt ID, amount, and description', () => {
    const message = buildReceiptShareMessage(request);

    expect(message).toContain('Payment Receipt RCP-SP-A82KD');
    expect(message).toContain('750 USDC received for Website Development.');
  });

  it('omits the description clause when the request has none', () => {
    const message = buildReceiptShareMessage({ ...request, description: undefined });
    expect(message).toContain('750 USDC received.');
  });
});
