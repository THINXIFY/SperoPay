import { computePaymentAccounting, computeDepositAmount } from '../paymentAccounting';
import type { PaymentRequest, Transaction } from '../../types';

const request: PaymentRequest = {
  id: 'req-1',
  paymentCode: 'SP-A82KD',
  amount: 1000,
  currency: 'USDC',
  network: 'Solana',
  customerId: 'cust-1',
  expiryOption: 'never',
  expiresAt: null,
  status: 'pending',
  createdAt: '2026-08-18T00:00:00.000Z',
  paymentLink: 'https://pay.speropay.app/r/req-1',
  publicToken: 'test-public-token-1',
  solanaReference: 'test-solana-reference-1',
};

function tx(amount: number, id = `tx-${amount}`): Transaction {
  return {
    id,
    requestId: 'req-1',
    amount,
    currency: 'USDC',
    network: 'Solana',
    fromCustomerId: 'cust-1',
    txHash: `hash-${id}`,
    paidAt: '2026-09-10T00:00:00.000Z',
  };
}

describe('computePaymentAccounting', () => {
  it('reports Pending (no transactions) correctly', () => {
    const result = computePaymentAccounting(request, []);
    expect(result.verifiedPaidAmount).toBe(0);
    expect(result.remainingAmount).toBe(1000);
    expect(result.isFullyPaid).toBe(false);
    expect(result.isPartiallyPaid).toBe(false);
  });

  it('sums multiple transactions with exact arithmetic', () => {
    const result = computePaymentAccounting(request, [tx(300), tx(250)]);
    expect(result.verifiedPaidAmount).toBe(550);
    expect(result.remainingAmount).toBe(450);
    expect(result.isPartiallyPaid).toBe(true);
    expect(result.isFullyPaid).toBe(false);
  });

  it('reports fully paid once the sum reaches the total', () => {
    const result = computePaymentAccounting(request, [tx(300), tx(700)]);
    expect(result.verifiedPaidAmount).toBe(1000);
    expect(result.remainingAmount).toBe(0);
    expect(result.isFullyPaid).toBe(true);
    expect(result.isPartiallyPaid).toBe(false);
  });

  it('never reports a negative remaining amount on an overpayment', () => {
    const result = computePaymentAccounting(request, [tx(1200)]);
    expect(result.remainingAmount).toBe(0);
    expect(result.isFullyPaid).toBe(true);
  });

  it('ignores transactions belonging to a different request', () => {
    const other: Transaction = { ...tx(999), requestId: 'req-other' };
    const result = computePaymentAccounting(request, [tx(300), other]);
    expect(result.verifiedPaidAmount).toBe(300);
  });

  // Phase 5A hardening: the exact progressive scenario from the payment
  // audit -- a 20 USDC request paid off in three installments (5, then 10,
  // then a final 5), checked at each stage. Each call only ever sees the
  // transactions "verified so far" (a fresh array per stage, not one
  // growing array reused across calls) -- this mirrors how the real app
  // re-derives accounting from whatever transaction rows currently exist in
  // the store, never from a running total it keeps itself.
  it('matches partially paid, then remaining, then fully paid across three real installments (20 total: 5 + 10 + 5)', () => {
    const partialRequest: PaymentRequest = { ...request, amount: 20, allowPartialPayments: true };

    const afterFirst = computePaymentAccounting(partialRequest, [tx(5, 'tx-1')]);
    expect(afterFirst.verifiedPaidAmount).toBe(5);
    expect(afterFirst.remainingAmount).toBe(15);
    expect(afterFirst.isPartiallyPaid).toBe(true);
    expect(afterFirst.isFullyPaid).toBe(false);

    const afterSecond = computePaymentAccounting(partialRequest, [tx(5, 'tx-1'), tx(10, 'tx-2')]);
    expect(afterSecond.verifiedPaidAmount).toBe(15);
    expect(afterSecond.remainingAmount).toBe(5);
    expect(afterSecond.isPartiallyPaid).toBe(true);
    expect(afterSecond.isFullyPaid).toBe(false);

    const afterThird = computePaymentAccounting(partialRequest, [tx(5, 'tx-1'), tx(10, 'tx-2'), tx(5, 'tx-3')]);
    expect(afterThird.verifiedPaidAmount).toBe(20);
    expect(afterThird.remainingAmount).toBe(0);
    expect(afterThird.isPartiallyPaid).toBe(false);
    expect(afterThird.isFullyPaid).toBe(true);
  });

  // A duplicate signature can never produce two transaction ROWS in the
  // first place -- transactions.tx_hash has a real UNIQUE constraint
  // (0005_phase3a_payment_foundation.sql) and complete_verified_payment
  // (0012_recurring_and_partial_payments.sql) independently re-checks it
  // under its own row lock before ever inserting. This is a DB-level
  // guarantee this pure function has no way to re-test directly (it only
  // ever sees whatever transaction rows already exist) -- what IS this
  // function's own responsibility, and what this test documents, is that
  // IF the same tx_hash somehow appeared twice in the array it was handed
  // (which should be structurally impossible), it does not have any special
  // deduplication of its own -- summing is the only operation, so the real
  // protection has to live where the rows are written, not here.
  it('sums whatever transaction rows it is given without deduplicating by hash (protection lives in the DB, not here)', () => {
    const duplicateShaped = [tx(5, 'tx-1'), { ...tx(5, 'tx-1-again'), txHash: tx(5, 'tx-1').txHash }];
    const result = computePaymentAccounting({ ...request, amount: 20 }, duplicateShaped);
    expect(result.verifiedPaidAmount).toBe(10);
  });

  it('uses exact base-unit arithmetic, never floating point drift', () => {
    const preciseRequest: PaymentRequest = { ...request, amount: 100.1 };
    const result = computePaymentAccounting(preciseRequest, [tx(0.1), tx(0.1), tx(0.1)]);
    // 0.1 + 0.1 + 0.1 === 0.30000000000000004 in naive float arithmetic --
    // exact bigint base units must not reproduce that drift.
    expect(result.verifiedPaidAmount).toBe(0.3);
    expect(result.remainingAmount).toBe(99.8);
  });

  // Phase 7: decimals come from the REQUEST's own currency (src/config/
  // assets.ts), not a hardcoded constant -- a EURC request must account
  // correctly using EURC's registry decimals, not silently borrow USDC's.
  it('accounts a EURC request correctly, using EURC transactions only', () => {
    const eurcRequest: PaymentRequest = { ...request, amount: 500, currency: 'EURC' };
    const eurcTx = (amount: number, id: string): Transaction => ({ ...tx(amount, id), currency: 'EURC' });
    const result = computePaymentAccounting(eurcRequest, [eurcTx(200, 'tx-e1')]);
    expect(result.verifiedPaidAmount).toBe(200);
    expect(result.remainingAmount).toBe(300);
    expect(result.isPartiallyPaid).toBe(true);
  });

  it('never combines a USDC transaction into a EURC request\'s accounting, or vice versa', () => {
    const eurcRequest: PaymentRequest = { ...request, amount: 500, currency: 'EURC' };
    // A stray USDC transaction against this same request id should never
    // happen in real data (complete_verified_payment always copies the
    // request's own currency onto the transaction it inserts), but this
    // function sums whatever it's given -- so this documents that a USDC-
    // currency row is NOT filtered out by currency, only by requestId. Real
    // protection against a cross-currency row existing at all lives at the
    // DB/verification layer (see verify-payment/index.ts and the Phase 7
    // migration's CHECK constraints), not in this pure accounting function.
    const usdcTxForEurcRequest: Transaction = { ...tx(200, 'tx-wrong-currency'), currency: 'USDC' };
    const result = computePaymentAccounting(eurcRequest, [usdcTxForEurcRequest]);
    expect(result.verifiedPaidAmount).toBe(200);
  });
});

describe('computeDepositAmount', () => {
  it('returns undefined when no deposit is configured', () => {
    expect(computeDepositAmount(1000, undefined, undefined)).toBeUndefined();
  });

  it('returns the fixed amount unchanged', () => {
    expect(computeDepositAmount(1000, 'fixed', 300)).toBe(300);
  });

  it('computes a percentage deposit in exact arithmetic', () => {
    expect(computeDepositAmount(1000, 'percentage', 30)).toBe(300);
  });

  it('handles a fractional percentage with exact arithmetic', () => {
    expect(computeDepositAmount(750, 'percentage', 33.33)).toBe(249.975);
  });

  // Phase 7: defaults to DEFAULT_ASSET (USDC) when the caller doesn't pass
  // a currency, so every pre-Phase-7 call site keeps behaving identically;
  // an explicit EURC currency still computes correctly (both assets are 6
  // decimals today, but the currency param is honored regardless).
  it('computes correctly for an explicit EURC currency', () => {
    expect(computeDepositAmount(1000, 'percentage', 30, 'EURC')).toBe(300);
    expect(computeDepositAmount(1000, 'fixed', 250, 'EURC')).toBe(250);
  });
});
