import { getCurrenciesInUse, sumByCurrency } from '../currencyGrouping';

describe('getCurrenciesInUse', () => {
  it('returns an empty array when every list is empty', () => {
    expect(getCurrenciesInUse([], [])).toEqual([]);
  });

  it('returns just USDC for USDC-only data (the pre-Phase-7 case)', () => {
    expect(getCurrenciesInUse([{ currency: 'USDC' as const }, { currency: 'USDC' as const }])).toEqual(['USDC']);
  });

  it('returns both currencies in canonical order regardless of input order', () => {
    expect(getCurrenciesInUse([{ currency: 'EURC' as const }, { currency: 'USDC' as const }])).toEqual(['USDC', 'EURC']);
  });

  it('merges currencies found across multiple input lists', () => {
    expect(getCurrenciesInUse([{ currency: 'USDC' as const }], [{ currency: 'EURC' as const }])).toEqual(['USDC', 'EURC']);
  });
});

describe('sumByCurrency', () => {
  it('never combines different assets into one total', () => {
    const items = [
      { currency: 'USDC' as const, amount: 1000 },
      { currency: 'EURC' as const, amount: 1000 },
      { currency: 'USDC' as const, amount: 400 },
    ];
    expect(sumByCurrency(items)).toEqual({ USDC: 1400, EURC: 1000 });
  });

  it('returns an empty object for an empty list', () => {
    expect(sumByCurrency([])).toEqual({});
  });
});
