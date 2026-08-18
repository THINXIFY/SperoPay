import { generateId, generatePaymentCode } from '../ids';

describe('generateId', () => {
  it('generates a non-empty unique string each call', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('generatePaymentCode', () => {
  it('generates a code matching the TP-XXXXX pattern', () => {
    const code = generatePaymentCode();
    expect(code).toMatch(/^TP-[A-Z0-9]{5}$/);
  });

  it('generates different codes on subsequent calls', () => {
    expect(generatePaymentCode()).not.toBe(generatePaymentCode());
  });
});
