// A small, dependency-free date-only (YYYY-MM-DD) parser for Reports'
// Custom Range inputs -- this app has no calendar-picker dependency
// anywhere (see the audit behind Phase 6B), and pulling one in just for a
// single custom-range field would be a disproportionately large addition
// for what two plain, validated text inputs already cover cleanly.
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Strict: rejects malformed strings, out-of-range month/day, and anything
// JS's Date constructor would otherwise silently "roll over" (e.g.
// "2026-02-30" must not silently become March 2nd).
export function parseDateOnlyInput(value: string): Date | null {
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function formatDateOnly(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
