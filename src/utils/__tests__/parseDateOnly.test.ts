import { parseDateOnlyInput, formatDateOnly } from '../parseDateOnly';

describe('parseDateOnlyInput', () => {
  it('parses a well-formed date', () => {
    const date = parseDateOnlyInput('2026-03-15');
    expect(date).toEqual(new Date(2026, 2, 15));
  });

  it('trims surrounding whitespace', () => {
    expect(parseDateOnlyInput('  2026-03-15 ')).toEqual(new Date(2026, 2, 15));
  });

  it('rejects a malformed string', () => {
    expect(parseDateOnlyInput('03/15/2026')).toBeNull();
    expect(parseDateOnlyInput('not a date')).toBeNull();
    expect(parseDateOnlyInput('')).toBeNull();
  });

  it('rejects an out-of-range month', () => {
    expect(parseDateOnlyInput('2026-13-01')).toBeNull();
  });

  it('rejects a date that would silently roll over (Feb 30)', () => {
    expect(parseDateOnlyInput('2026-02-30')).toBeNull();
  });
});

describe('formatDateOnly', () => {
  it('formats with zero-padded month and day', () => {
    expect(formatDateOnly(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  it('round-trips through parseDateOnlyInput', () => {
    const original = new Date(2026, 8, 30);
    expect(parseDateOnlyInput(formatDateOnly(original))).toEqual(original);
  });
});
