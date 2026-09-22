// Phase 7 -- the one shared helper every screen that sums money across a
// mixed request/transaction list must use, so "never mathematically mix
// USDC + EURC into one total" (spec section 14) is enforced in exactly one
// place rather than re-implemented (correctly or not) per screen. Callers
// filter their existing arrays to a single currency using
// getCurrenciesInUse's result, then run whatever calculation function
// (getReportsSummary, computePaymentAccounting, a plain reduce, ...) they
// already have once per currency -- this file has no opinion on what the
// per-currency calculation looks like, only on which currencies exist to
// calculate for.
import { SUPPORTED_ASSETS, type AssetSymbol } from '../config/assets';

// Canonical order (SUPPORTED_ASSETS' own order, i.e. USDC before EURC),
// never insertion order from the input arrays -- so a merchant's Reports
// screen always lists currencies the same way regardless of which one they
// happened to transact in first.
export function getCurrenciesInUse(...lists: Array<{ currency: AssetSymbol }>[]): AssetSymbol[] {
  const present = new Set<AssetSymbol>();
  for (const list of lists) {
    for (const item of list) present.add(item.currency);
  }
  return SUPPORTED_ASSETS.filter((asset) => present.has(asset));
}

export function sumByCurrency<T extends { currency: AssetSymbol; amount: number }>(items: T[]): Partial<Record<AssetSymbol, number>> {
  const totals: Partial<Record<AssetSymbol, number>> = {};
  for (const item of items) {
    totals[item.currency] = (totals[item.currency] ?? 0) + item.amount;
  }
  return totals;
}
