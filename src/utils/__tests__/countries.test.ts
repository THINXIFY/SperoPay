import { COUNTRIES, searchCountries, findCountryByName } from '../countries';

describe('COUNTRIES', () => {
  it('includes the complete ISO 3166-1 set, not a hand-picked subset', () => {
    // The authoritative ISO 3166-1 alpha-2 list has 249-250 entries
    // depending on dataset version -- asserting a wide floor here (not an
    // exact number) so this doesn't break on a routine dependency bump,
    // while still catching an accidentally-truncated list.
    expect(COUNTRIES.length).toBeGreaterThan(240);
  });

  it('is sorted alphabetically by display name', () => {
    const names = COUNTRIES.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('every entry has a 2-letter code, a name, and a 2-codepoint flag emoji', () => {
    for (const country of COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.name.length).toBeGreaterThan(0);
      expect([...country.flag].length).toBe(2);
    }
  });

  it('has no duplicate codes', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('uses the common display name for well-known countries, not the long official form', () => {
    expect(COUNTRIES.find((c) => c.code === 'US')?.name).toBe('United States');
    expect(COUNTRIES.find((c) => c.code === 'GB')?.name).toBe('United Kingdom');
    expect(COUNTRIES.find((c) => c.code === 'AE')?.name).toBe('United Arab Emirates');
    expect(COUNTRIES.find((c) => c.code === 'PK')?.name).toBe('Pakistan');
  });
});

describe('searchCountries', () => {
  it('returns the full list for an empty query', () => {
    expect(searchCountries('')).toHaveLength(COUNTRIES.length);
    expect(searchCountries('   ')).toHaveLength(COUNTRIES.length);
  });

  it('filters by a case-insensitive substring of the name', () => {
    const results = searchCountries('pak');
    expect(results.some((c) => c.name === 'Pakistan')).toBe(true);
    expect(results.every((c) => c.name.toLowerCase().includes('pak'))).toBe(true);
  });

  it('matches an exact ISO code regardless of case', () => {
    const results = searchCountries('pk');
    expect(results.some((c) => c.code === 'PK')).toBe(true);
  });

  it('returns no results for a nonsense query', () => {
    expect(searchCountries('zzzzznotacountry')).toHaveLength(0);
  });
});

describe('findCountryByName', () => {
  it('finds an exact match', () => {
    expect(findCountryByName('Pakistan')?.code).toBe('PK');
  });

  it('returns undefined for an unrecognized name', () => {
    expect(findCountryByName('Not A Real Country')).toBeUndefined();
  });
});
