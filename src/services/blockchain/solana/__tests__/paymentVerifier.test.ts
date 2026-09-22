import { verifyPayment } from '../paymentVerifier';
import type { VerifyPaymentParams } from '../paymentVerifier';
import type { ExpectedPayment, ParsedPaymentTransaction } from '../types';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const OTHER_MINT = 'So11111111111111111111111111111111111111112';
const MERCHANT_WALLET = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
const OTHER_WALLET = '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu';

function buildExpected(overrides: Partial<ExpectedPayment> = {}): ExpectedPayment {
  return {
    network: 'devnet',
    mint: USDC_MINT,
    destinationWallet: MERCHANT_WALLET,
    amountBaseUnits: 10_500_000n,
    notAfter: null,
    ...overrides,
  };
}

function buildTx(overrides: Partial<ParsedPaymentTransaction> = {}): ParsedPaymentTransaction {
  return {
    signature: 'sig-1',
    succeeded: true,
    slot: 1,
    blockTime: 1_700_000_000,
    transfers: [
      {
        mint: USDC_MINT,
        destinationTokenAccount: 'tokenAccount1',
        destinationOwner: MERCHANT_WALLET,
        amountBaseUnits: 10_500_000n,
      },
    ],
    ...overrides,
  };
}

function buildParams(overrides: Partial<VerifyPaymentParams> = {}): VerifyPaymentParams {
  return {
    tx: buildTx(),
    expected: buildExpected(),
    confirmationLevel: 'confirmed',
    requiredConfirmationLevel: 'confirmed',
    alreadyCredited: false,
    ...overrides,
  };
}

describe('verifyPayment', () => {
  it('accepts a transaction that matches mint, destination, amount, and confirmation', () => {
    const result = verifyPayment(buildParams());

    expect(result).toEqual({
      valid: true,
      signature: 'sig-1',
      amountBaseUnits: 10_500_000n,
      blockTime: 1_700_000_000,
    });
  });

  it('rejects when the transaction was not found', () => {
    expect(verifyPayment(buildParams({ tx: null }))).toEqual({
      valid: false,
      reason: 'transaction_not_found',
    });
  });

  it('rejects a failed transaction', () => {
    const result = verifyPayment(buildParams({ tx: buildTx({ succeeded: false }) }));
    expect(result).toEqual({ valid: false, reason: 'transaction_failed' });
  });

  it('rejects an already-credited (duplicate signature) transaction', () => {
    const result = verifyPayment(buildParams({ alreadyCredited: true }));
    expect(result).toEqual({ valid: false, reason: 'already_credited' });
  });

  it('rejects a transaction confirmed after the request expired', () => {
    const result = verifyPayment(
      buildParams({
        expected: buildExpected({ notAfter: new Date(1_699_999_000 * 1000) }),
        tx: buildTx({ blockTime: 1_700_000_000 }),
      })
    );
    expect(result).toEqual({ valid: false, reason: 'expired' });
  });

  it('accepts a transaction confirmed before the request expired', () => {
    const result = verifyPayment(
      buildParams({
        expected: buildExpected({ notAfter: new Date(1_700_001_000 * 1000) }),
        tx: buildTx({ blockTime: 1_700_000_000 }),
      })
    );
    expect(result.valid).toBe(true);
  });

  it('rejects (does not fail open) when the request has an expiry but the transaction has no blockTime to check it against', () => {
    const result = verifyPayment(
      buildParams({
        expected: buildExpected({ notAfter: new Date(1_700_001_000 * 1000) }),
        tx: buildTx({ blockTime: null }),
      })
    );
    expect(result).toEqual({ valid: false, reason: 'expired' });
  });

  it('accepts a transaction with no blockTime when the request has no expiry to check', () => {
    const result = verifyPayment(
      buildParams({
        expected: buildExpected({ notAfter: null }),
        tx: buildTx({ blockTime: null }),
      })
    );
    expect(result.valid).toBe(true);
  });

  it('rejects when no transfer uses the expected mint', () => {
    const result = verifyPayment(
      buildParams({ tx: buildTx({ transfers: [{ mint: OTHER_MINT, destinationTokenAccount: 'x', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 10_500_000n }] }) })
    );
    expect(result).toEqual({ valid: false, reason: 'wrong_mint' });
  });

  it('rejects when the right mint went to the wrong wallet', () => {
    const result = verifyPayment(
      buildParams({ tx: buildTx({ transfers: [{ mint: USDC_MINT, destinationTokenAccount: 'x', destinationOwner: OTHER_WALLET, amountBaseUnits: 10_500_000n }] }) })
    );
    expect(result).toEqual({ valid: false, reason: 'wrong_destination' });
  });

  it('rejects when the right mint went to the right wallet but the wrong amount', () => {
    const result = verifyPayment(
      buildParams({ tx: buildTx({ transfers: [{ mint: USDC_MINT, destinationTokenAccount: 'x', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 1n }] }) })
    );
    expect(result).toEqual({ valid: false, reason: 'wrong_amount' });
  });

  it('rejects a transaction with no confirmation status yet', () => {
    const result = verifyPayment(buildParams({ confirmationLevel: null }));
    expect(result).toEqual({ valid: false, reason: 'insufficient_confirmation' });
  });

  it('rejects a merely "processed" transaction when "confirmed" is required', () => {
    const result = verifyPayment(buildParams({ confirmationLevel: 'processed', requiredConfirmationLevel: 'confirmed' }));
    expect(result).toEqual({ valid: false, reason: 'insufficient_confirmation' });
  });

  it('accepts a "finalized" transaction when only "confirmed" is required', () => {
    const result = verifyPayment(buildParams({ confirmationLevel: 'finalized', requiredConfirmationLevel: 'confirmed' }));
    expect(result.valid).toBe(true);
  });

  // Phase 7 (USDC + EURC) -- the exact cross-asset security guarantee the
  // spec requires: a EURC payment must never satisfy a USDC request, and
  // vice versa. Uses the real, Circle-verified mainnet mint addresses (see
  // src/config/assets.ts) rather than an arbitrary unrelated mint, so this
  // test documents the actual two supported assets, not just "some other
  // mint".
  describe('cross-asset security (USDC vs EURC)', () => {
    const REAL_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const REAL_EURC_MINT = 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr';

    it('a EURC transfer does not satisfy a request expecting USDC', () => {
      const result = verifyPayment(
        buildParams({
          expected: buildExpected({ mint: REAL_USDC_MINT }),
          tx: buildTx({
            transfers: [{ mint: REAL_EURC_MINT, destinationTokenAccount: 'x', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 10_500_000n }],
          }),
        })
      );
      expect(result).toEqual({ valid: false, reason: 'wrong_mint' });
    });

    it('a USDC transfer does not satisfy a request expecting EURC', () => {
      const result = verifyPayment(
        buildParams({
          expected: buildExpected({ mint: REAL_EURC_MINT }),
          tx: buildTx({
            transfers: [{ mint: REAL_USDC_MINT, destinationTokenAccount: 'x', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 10_500_000n }],
          }),
        })
      );
      expect(result).toEqual({ valid: false, reason: 'wrong_mint' });
    });

    it('a EURC transfer DOES satisfy a request that actually expects EURC', () => {
      const result = verifyPayment(
        buildParams({
          expected: buildExpected({ mint: REAL_EURC_MINT }),
          tx: buildTx({
            transfers: [{ mint: REAL_EURC_MINT, destinationTokenAccount: 'x', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 10_500_000n }],
          }),
        })
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('partial-payment range matching', () => {
    it('accepts any amount within [min, max] instead of requiring an exact match', () => {
      const result = verifyPayment(
        buildParams({
          expected: buildExpected({ minAmountBaseUnits: 300_000_000n, maxAmountBaseUnits: 1_000_000_000n }),
          tx: buildTx({ transfers: [{ mint: USDC_MINT, destinationTokenAccount: 'x', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 500_000_000n }] }),
        })
      );
      expect(result).toEqual({ valid: true, signature: 'sig-1', amountBaseUnits: 500_000_000n, blockTime: 1_700_000_000 });
    });

    it('accepts an amount exactly at the minimum (the deposit) or maximum (the full remaining balance)', () => {
      const expected = buildExpected({ minAmountBaseUnits: 300_000_000n, maxAmountBaseUnits: 1_000_000_000n });
      const atMin = verifyPayment(
        buildParams({ expected, tx: buildTx({ transfers: [{ mint: USDC_MINT, destinationTokenAccount: 'x', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 300_000_000n }] }) })
      );
      const atMax = verifyPayment(
        buildParams({ expected, tx: buildTx({ transfers: [{ mint: USDC_MINT, destinationTokenAccount: 'x', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 1_000_000_000n }] }) })
      );
      expect(atMin.valid).toBe(true);
      expect(atMax.valid).toBe(true);
    });

    it('rejects an amount below the required minimum deposit', () => {
      const result = verifyPayment(
        buildParams({
          expected: buildExpected({ minAmountBaseUnits: 300_000_000n, maxAmountBaseUnits: 1_000_000_000n }),
          tx: buildTx({ transfers: [{ mint: USDC_MINT, destinationTokenAccount: 'x', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 100_000_000n }] }),
        })
      );
      expect(result).toEqual({ valid: false, reason: 'wrong_amount' });
    });

    it('rejects an amount above the remaining balance (prevents crediting an overpayment)', () => {
      const result = verifyPayment(
        buildParams({
          expected: buildExpected({ minAmountBaseUnits: 300_000_000n, maxAmountBaseUnits: 1_000_000_000n }),
          tx: buildTx({ transfers: [{ mint: USDC_MINT, destinationTokenAccount: 'x', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 1_500_000_000n }] }),
        })
      );
      expect(result).toEqual({ valid: false, reason: 'wrong_amount' });
    });

    it('ignores amountBaseUnits entirely once a range is set', () => {
      // amountBaseUnits on `expected` is still the buildExpected() default
      // (10_500_000n) -- a transfer matching neither that exact value nor
      // being reachable any other way must still succeed purely via range.
      const result = verifyPayment(
        buildParams({
          expected: buildExpected({ minAmountBaseUnits: 1n, maxAmountBaseUnits: 1_000_000_000n }),
          tx: buildTx({ transfers: [{ mint: USDC_MINT, destinationTokenAccount: 'x', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 42n }] }),
        })
      );
      expect(result.valid).toBe(true);
    });
  });

  it('picks the matching transfer out of several in the same transaction', () => {
    const result = verifyPayment(
      buildParams({
        tx: buildTx({
          transfers: [
            { mint: OTHER_MINT, destinationTokenAccount: 'a', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 999n },
            { mint: USDC_MINT, destinationTokenAccount: 'b', destinationOwner: OTHER_WALLET, amountBaseUnits: 10_500_000n },
            { mint: USDC_MINT, destinationTokenAccount: 'c', destinationOwner: MERCHANT_WALLET, amountBaseUnits: 10_500_000n },
          ],
        }),
      })
    );
    expect(result).toEqual({
      valid: true,
      signature: 'sig-1',
      amountBaseUnits: 10_500_000n,
      blockTime: 1_700_000_000,
    });
  });
});
