import * as countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

// Metro resolves the bare package specifier to its lightweight `browser`
// entry (plain functions, no data), not its Node `main` entry (which
// eagerly requires and registers all ~80 locale files) -- so English must
// be registered explicitly here, once, at module load.
countries.registerLocale(enLocale as countries.LocaleData);

export interface Country {
  code: string; // ISO 3166-1 alpha-2, e.g. "PK"
  name: string;
  flag: string; // emoji, derived from the code -- no image assets needed
}

// This dataset's default ("official") name is the long constitutional/
// formal form for a handful of well-known countries -- e.g. "United
// States of America" for US, "Russian Federation" for RU. Overridden here
// for display only, purely cosmetic: the underlying code/name list itself
// is still the complete, authoritative ISO 3166-1 set (250 entries), not
// a hand-picked subset.
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  US: 'United States',
  KP: 'North Korea',
  RU: 'Russia',
  IR: 'Iran',
  SY: 'Syria',
  LA: 'Laos',
  VE: 'Venezuela',
  BO: 'Bolivia',
  TZ: 'Tanzania',
  MD: 'Moldova',
  FM: 'Micronesia',
  CD: 'DR Congo',
  VA: 'Vatican City',
  BN: 'Brunei',
};

function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function buildCountryList(): Country[] {
  const namesByCode = countries.getNames('en', { select: 'official' });
  return Object.entries(namesByCode)
    .map(([code, officialName]) => ({
      code,
      name: DISPLAY_NAME_OVERRIDES[code] ?? officialName,
      flag: flagEmoji(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Built once at module load -- the full list is static and small (250
// entries, a few KB), so there's no benefit to recomputing it per render.
export const COUNTRIES: Country[] = buildCountryList();

export function findCountryByName(name: string): Country | undefined {
  return COUNTRIES.find((c) => c.name === name);
}

export function searchCountries(query: string): Country[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return COUNTRIES;
  return COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(normalized) || c.code.toLowerCase() === normalized
  );
}
