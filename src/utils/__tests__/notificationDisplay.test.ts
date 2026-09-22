import { parsePaymentAmountFromMessage } from '../notificationDisplay';

describe('parsePaymentAmountFromMessage', () => {
  it('parses a whole-number USDC payment message', () => {
    expect(parsePaymentAmountFromMessage('250 USDC received for SP-2K48.')).toEqual({
      amountText: '250',
      currency: 'USDC',
      paymentCode: 'SP-2K48',
    });
  });

  it('parses a decimal EURC payment message', () => {
    expect(parsePaymentAmountFromMessage('99.5 EURC received for SP-ABCDE.')).toEqual({
      amountText: '99.5',
      currency: 'EURC',
      paymentCode: 'SP-ABCDE',
    });
  });

  it('tolerates a missing trailing period', () => {
    expect(parsePaymentAmountFromMessage('40 USDC received for SP-2K48')).toEqual({
      amountText: '40',
      currency: 'USDC',
      paymentCode: 'SP-2K48',
    });
  });

  it('returns null for null/undefined/empty message, never throws', () => {
    expect(parsePaymentAmountFromMessage(null)).toBeNull();
    expect(parsePaymentAmountFromMessage(undefined)).toBeNull();
    expect(parsePaymentAmountFromMessage('')).toBeNull();
  });

  // Graceful degradation: a message that doesn't match the exact
  // server-authored shape (e.g. a future copy change, or an unrelated
  // notification type's message) is never force-parsed into garbage.
  it('returns null for an unrelated or malformed message', () => {
    expect(parsePaymentAmountFromMessage('Your customer opened the payment link for SP-2K48.')).toBeNull();
    expect(parsePaymentAmountFromMessage('A reminder was sent to Alex Morgan.')).toBeNull();
    expect(parsePaymentAmountFromMessage('received for SP-2K48.')).toBeNull();
    expect(parsePaymentAmountFromMessage('250 BTC received for SP-2K48.')).toBeNull();
  });
});
