import type { PaymentRequest, Transaction } from '../types';
import { computePaymentAccounting } from './paymentAccounting';
import type { AssetSymbol } from '../config/assets';

export interface CustomerCurrencyStats {
  totalReceived: number;
  outstanding: number;
}

export interface CustomerStats {
  totalRequests: number;
  // Phase 7: never a single combined number across assets (spec section
  // 14's "do not mathematically mix USDC + EURC" rule applies here too --
  // a customer who has paid in both currencies must show two separate
  // totals, not one number that quietly added them together). Keyed only
  // by currencies this customer actually has a request in; a USDC-only
  // customer (every customer today) has exactly one key here, so existing
  // single-currency call sites see no behavior change.
  byCurrency: Partial<Record<AssetSymbol, CustomerCurrencyStats>>;
}

// Both totals are derived from computePaymentAccounting (the same exact
// bigint paid/remaining math Request Detail, invoices, receipts, and Phase
// 6B's Reports all use) -- never a raw `request.amount` sum. Before an
// earlier fix, totalReceived only counted requests already fully at
// status='paid' (missing any already-verified partial payment on a still-
// pending request) and outstanding summed the request's ORIGINAL amount
// instead of what's actually left to pay -- both silently wrong once
// partial payments exist, and both disagreed with Reports' own (correct)
// figures for the exact same data. See src/utils/reportsCalculations.ts's
// header comment for the shared financial-accuracy rules this follows.
//
// totalReceived sums every request's verifiedPaidAmount regardless of
// current status -- including a cancelled request that had already
// received a real partial payment before it was cancelled (that money was
// genuinely verified received; cancelling only stops collection of the
// remainder, it doesn't un-receive what already arrived). outstanding is
// still scoped to pending/confirming requests only -- a cancelled or paid
// request has nothing left to collect.
export function getCustomerStats(customerId: string, requests: PaymentRequest[], transactions: Transaction[]): CustomerStats {
  const customerRequests = requests.filter((r) => r.customerId === customerId);

  const byCurrency: Partial<Record<AssetSymbol, CustomerCurrencyStats>> = {};
  for (const request of customerRequests) {
    const accounting = computePaymentAccounting(request, transactions);
    const bucket = byCurrency[request.currency] ?? { totalReceived: 0, outstanding: 0 };
    bucket.totalReceived += accounting.verifiedPaidAmount;
    if (request.status === 'pending' || request.status === 'confirming') {
      bucket.outstanding += accounting.remainingAmount;
    }
    byCurrency[request.currency] = bucket;
  }

  return {
    totalRequests: customerRequests.length,
    byCurrency,
  };
}
