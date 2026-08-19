import { getInvoiceId, getReceiptId } from '../documentIds';
import type { PaymentRequest } from '../../types';

const request: PaymentRequest = {
  id: 'req-test',
  paymentCode: 'SP-A82KD',
  amount: 750,
  currency: 'USDC',
  network: 'Solana',
  description: 'Website Development',
  customerId: 'cust-1',
  expiryOption: '7d',
  expiresAt: '2026-08-26T00:00:00.000Z',
  status: 'pending',
  createdAt: '2026-08-19T00:00:00.000Z',
  paymentLink: 'https://pay.speropay.app/r/req-test',
};

describe('getInvoiceId', () => {
  it('prefixes the payment code with INV-', () => {
    expect(getInvoiceId(request)).toBe('INV-SP-A82KD');
  });
});

describe('getReceiptId', () => {
  it('prefixes the payment code with RCP-', () => {
    expect(getReceiptId(request)).toBe('RCP-SP-A82KD');
  });
});
