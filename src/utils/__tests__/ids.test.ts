import { generateId, generatePaymentCode, generateTxHash } from '../ids';

describe('generateId', () => {
  it('generates a non-empty unique string each call', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('generatePaymentCode', () => {
  it('generates a code matching the SP-XXXXX pattern', () => {
    const code = generatePaymentCode();
    expect(code).toMatch(/^SP-[A-Z0-9]{5}$/);
  });

  it('generates different codes on subsequent calls', () => {
    expect(generatePaymentCode()).not.toBe(generatePaymentCode());
  });
});

describe('generateTxHash', () => {
  it('generates a 43-character base58-style string', () => {
    const hash = generateTxHash();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(43);
    expect(hash).toMatch(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{43}$/);
  });

  it('generates different hashes on subsequent calls', () => {
    expect(generateTxHash()).not.toBe(generateTxHash());
  });
});
