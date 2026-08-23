import { toBaseUnits, fromBaseUnits } from '../amount';

describe('toBaseUnits', () => {
  it('converts a whole-dollar string amount', () => {
    expect(toBaseUnits('10', 6)).toBe(10_000_000n);
  });

  it('converts a fractional string amount', () => {
    expect(toBaseUnits('10.50', 6)).toBe(10_500_000n);
  });

  it('converts a number input via the same decimal path (no binary float drift)', () => {
    expect(toBaseUnits(0.1, 6)).toBe(100_000n);
    expect(toBaseUnits(10.5, 6)).toBe(10_500_000n);
  });

  it('handles zero', () => {
    expect(toBaseUnits('0', 6)).toBe(0n);
  });

  it('handles amounts with fewer decimal places than the token supports', () => {
    expect(toBaseUnits('1.5', 6)).toBe(1_500_000n);
  });

  it('handles negative amounts', () => {
    expect(toBaseUnits('-5.25', 6)).toBe(-5_250_000n);
  });

  it('throws on more decimal places than the token supports', () => {
    expect(() => toBaseUnits('1.1234567', 6)).toThrow(/more than 6 decimal places/);
  });

  it('throws on a malformed amount string', () => {
    expect(() => toBaseUnits('not-a-number', 6)).toThrow(/invalid amount/);
    expect(() => toBaseUnits('1.2.3', 6)).toThrow(/invalid amount/);
  });

  it('throws on empty/degenerate input instead of silently defaulting to zero', () => {
    expect(() => toBaseUnits('', 6)).toThrow(/invalid amount/);
    expect(() => toBaseUnits('   ', 6)).toThrow(/invalid amount/);
    expect(() => toBaseUnits('.', 6)).toThrow(/invalid amount/);
    expect(() => toBaseUnits('-', 6)).toThrow(/invalid amount/);
  });

  it('still accepts a leading-dot shorthand like ".5"', () => {
    expect(toBaseUnits('.5', 6)).toBe(500_000n);
  });
});

describe('fromBaseUnits', () => {
  it('round-trips whole and fractional amounts', () => {
    expect(fromBaseUnits(10_000_000n, 6)).toBe('10');
    expect(fromBaseUnits(10_500_000n, 6)).toBe('10.5');
  });

  it('handles zero', () => {
    expect(fromBaseUnits(0n, 6)).toBe('0');
  });

  it('handles negative amounts', () => {
    expect(fromBaseUnits(-5_250_000n, 6)).toBe('-5.25');
  });

  it('round-trips through toBaseUnits', () => {
    const original = '1234.567891';
    expect(fromBaseUnits(toBaseUnits(original, 6), 6)).toBe(original);
  });
});
