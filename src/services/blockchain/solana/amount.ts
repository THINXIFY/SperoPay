// Converts a decimal USDC amount to/from integer base units (bigint) —
// e.g. "10.50" with 6 decimals -> 10_500_000n. Deliberately string-based,
// never `amount * 10 ** decimals`: binary floating point cannot represent
// most decimal fractions exactly, and a multiplication-based conversion
// can silently produce an off-by-one-base-unit result for ordinary inputs
// (spec section 9's core requirement — no float arithmetic anywhere near
// a payment amount comparison).
//
// `number` input is accepted for convenience (the app's existing domain
// types store `amount: number`) and is converted via `toFixed`, which
// captures the decimal's intended display value directly rather than
// doing binary arithmetic on it — safe for realistic payment amounts
// (well within the 53-bit mantissa's exact-integer range at 6 decimals).
// Prefer passing a string directly wherever the value is already one.
export function toBaseUnits(amount: string | number, decimals: number): bigint {
  const str = typeof amount === 'number' ? amount.toFixed(decimals) : amount.trim();
  const negative = str.startsWith('-');
  const unsigned = negative ? str.slice(1) : str;
  const [wholePartRaw, fractionPartRaw = ''] = unsigned.split('.');
  const wholePart = wholePartRaw || '0';

  if (!/^\d+$/.test(wholePart) || (fractionPartRaw.length > 0 && !/^\d+$/.test(fractionPartRaw))) {
    throw new Error(`toBaseUnits: invalid amount "${amount}"`);
  }
  if (fractionPartRaw.length > decimals) {
    throw new Error(`toBaseUnits: "${amount}" has more than ${decimals} decimal places`);
  }

  const fractionPart = fractionPartRaw.padEnd(decimals, '0');
  const value = BigInt(wholePart + fractionPart);
  return negative ? -value : value;
}

export function fromBaseUnits(baseUnits: bigint, decimals: number): string {
  const negative = baseUnits < 0n;
  const abs = negative ? -baseUnits : baseUnits;
  const digits = abs.toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');
  const result = fraction ? `${whole}.${fraction}` : whole;
  return negative ? `-${result}` : result;
}
