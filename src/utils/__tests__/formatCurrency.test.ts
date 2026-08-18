import { formatCurrency } from '../formatCurrency';

describe('formatCurrency', () => {
  it('formats with two decimals and thousands separators', () => {
    expect(formatCurrency(12540.25)).toBe('$12,540.25');
    expect(formatCurrency(750)).toBe('$750.00');
    expect(formatCurrency(0)).toBe('$0.00');
  });
});
