import type { AssetSymbol } from '../config/assets';

// Phase 7: every asset Spero supports (USDC, EURC) is a stablecoin, never
// real fiat -- there is no "$" that correctly labels a EURC amount, and
// this app performs no FX conversion between assets (spec section 20).
// formatCurrency therefore returns a bare, currency-symbol-free number
// (grouping + exactly 2 decimals); every call site is expected to show the
// asset symbol itself alongside it (most already do, e.g.
// `${formatCurrency(amount)} ${request.currency}`), or to use
// formatAssetAmount below for a single combined string.
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// A short, chart-axis-friendly form (1.2K / 3.4M) for contexts where a
// full formatCurrency() value would overflow a small label -- e.g. Reports'
// revenue chart y-axis or a large hero amount on a narrow device. Never
// used for a primary displayed amount (those always use the exact,
// unabbreviated formatCurrency), only for secondary/space-constrained UI.
export function formatCompactCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

// The single combined "1,250.00 USDC" / "850.00 EURC" string the spec
// (section 16) asks for -- for contexts that need one string rather than a
// separate amount + currency element (CSV cells, share/notification text,
// PDF table rows). UI screens that already render the amount and currency
// as two adjacent elements should keep doing that (formatCurrency +
// {request.currency}), not switch to this.
export function formatAssetAmount(amount: number, currency: AssetSymbol): string {
  return `${formatCurrency(amount)} ${currency}`;
}
