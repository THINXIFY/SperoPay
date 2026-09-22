import { formatCurrency, formatCompactCurrency, formatAssetAmount } from '../formatCurrency';

describe('formatCurrency', () => {
  it('formats with two decimals and thousands separators, no currency symbol', () => {
    expect(formatCurrency(12540.25)).toBe('12,540.25');
    expect(formatCurrency(750)).toBe('750.00');
    expect(formatCurrency(0)).toBe('0.00');
  });
});

describe('formatCompactCurrency', () => {
  it('abbreviates thousands and millions, no currency symbol', () => {
    expect(formatCompactCurrency(1200)).toBe('1.2K');
    expect(formatCompactCurrency(3400000)).toBe('3.4M');
  });

  it('leaves small amounts unabbreviated', () => {
    expect(formatCompactCurrency(75)).toBe('75');
  });
});

describe('formatAssetAmount', () => {
  it('combines the formatted amount with the asset symbol', () => {
    expect(formatAssetAmount(1250, 'USDC')).toBe('1,250.00 USDC');
    expect(formatAssetAmount(850, 'EURC')).toBe('850.00 EURC');
  });
});
