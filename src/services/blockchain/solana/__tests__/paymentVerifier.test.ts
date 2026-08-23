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
    usdcMint: USDC_MINT,
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
