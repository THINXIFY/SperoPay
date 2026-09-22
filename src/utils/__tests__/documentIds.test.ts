import { getInvoiceId, getReceiptId } from '../documentIds';

describe('getInvoiceId', () => {
  it('prefixes the payment code with INV-', () => {
    expect(getInvoiceId('SP-A82KD')).toBe('INV-SP-A82KD');
  });
});

describe('getReceiptId', () => {
  it('prefixes the payment code with RCP-', () => {
    expect(getReceiptId('SP-A82KD')).toBe('RCP-SP-A82KD');
  });
});
