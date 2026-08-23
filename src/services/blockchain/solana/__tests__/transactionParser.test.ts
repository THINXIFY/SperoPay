import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import { parsePaymentTransaction } from '../transactionParser';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const OTHER_MINT = 'So11111111111111111111111111111111111111112';
const MERCHANT_WALLET = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
const PAYER_WALLET = '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu';

function pubkey(address: string) {
  return { pubkey: { toBase58: () => address } };
}

function tokenBalance(accountIndex: number, mint: string, owner: string, rawAmount: string) {
  return {
    accountIndex,
    mint,
    owner,
    uiTokenAmount: { amount: rawAmount, decimals: 6, uiAmount: Number(rawAmount) / 1_000_000 },
  };
}

// Casting through `unknown` -- these fixtures only need to satisfy the
// handful of fields transactionParser.ts actually reads, not the full real
// web3.js type (which pulls in far more than a fixture needs).
function buildTx(overrides: Record<string, unknown> = {}): ParsedTransactionWithMeta {
  const base = {
    slot: 123,
    blockTime: 1_700_000_000,
    transaction: {
      message: {
        accountKeys: [pubkey(PAYER_WALLET), pubkey('destinationTokenAccountAddress'), pubkey(MERCHANT_WALLET)],
      },
    },
    meta: {
      err: null,
      preTokenBalances: [tokenBalance(1, USDC_MINT, MERCHANT_WALLET, '0')],
      postTokenBalances: [tokenBalance(1, USDC_MINT, MERCHANT_WALLET, '10500000')],
    },
  };
  return { ...base, ...overrides } as unknown as ParsedTransactionWithMeta;
}

describe('parsePaymentTransaction', () => {
  it('extracts a matching USDC transfer with the correct amount and destination owner', () => {
    const result = parsePaymentTransaction('sig1', buildTx(), USDC_MINT);

    expect(result.succeeded).toBe(true);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toEqual({
      mint: USDC_MINT,
      destinationTokenAccount: 'destinationTokenAccountAddress',
      destinationOwner: MERCHANT_WALLET,
      amountBaseUnits: 10_500_000n,
    });
  });

  it('reports succeeded: false for a failed transaction, without discarding its transfers', () => {
    // Verification (not parsing) is what should reject a failed tx -- the
    // parser stays a faithful, defensive extractor of what's actually there.
    const result = parsePaymentTransaction('sig2', buildTx({ meta: { err: { InstructionError: [] }, preTokenBalances: [tokenBalance(1, USDC_MINT, MERCHANT_WALLET, '0')], postTokenBalances: [tokenBalance(1, USDC_MINT, MERCHANT_WALLET, '5000000')] } }), USDC_MINT);

    expect(result.succeeded).toBe(false);
    expect(result.transfers).toHaveLength(1);
  });

  it('ignores token balance entries for a different mint', () => {
    const result = parsePaymentTransaction(
      'sig3',
      buildTx({
        meta: {
          err: null,
          preTokenBalances: [tokenBalance(1, OTHER_MINT, MERCHANT_WALLET, '0')],
          postTokenBalances: [tokenBalance(1, OTHER_MINT, MERCHANT_WALLET, '99000000')],
        },
      }),
      USDC_MINT
    );

    expect(result.transfers).toHaveLength(0);
  });

  it('ignores an account whose balance decreased (the sender), not just an unrelated mint', () => {
    const result = parsePaymentTransaction(
      'sig4',
      buildTx({
        meta: {
          err: null,
          preTokenBalances: [tokenBalance(0, USDC_MINT, PAYER_WALLET, '20000000')],
          postTokenBalances: [tokenBalance(0, USDC_MINT, PAYER_WALLET, '9500000')],
        },
      }),
      USDC_MINT
    );

    expect(result.transfers).toHaveLength(0);
  });

  it('extracts multiple simultaneous transfers, not just the first', () => {
    const result = parsePaymentTransaction(
      'sig5',
      buildTx({
        meta: {
          err: null,
          preTokenBalances: [
            tokenBalance(1, USDC_MINT, MERCHANT_WALLET, '0'),
            tokenBalance(2, USDC_MINT, 'someOtherMerchant', '0'),
          ],
          postTokenBalances: [
            tokenBalance(1, USDC_MINT, MERCHANT_WALLET, '1000000'),
            tokenBalance(2, USDC_MINT, 'someOtherMerchant', '2000000'),
          ],
        },
        transaction: {
          message: {
            accountKeys: [
              pubkey(PAYER_WALLET),
              pubkey('tokenAccountA'),
              pubkey('tokenAccountB'),
            ],
          },
        },
      }),
      USDC_MINT
    );

    expect(result.transfers).toHaveLength(2);
    expect(result.transfers.map((t) => t.amountBaseUnits)).toEqual([1_000_000n, 2_000_000n]);
  });

  it('handles a malformed/missing meta gracefully instead of throwing', () => {
    const result = parsePaymentTransaction('sig6', buildTx({ meta: null }), USDC_MINT);

    expect(result.succeeded).toBe(false);
    expect(result.transfers).toEqual([]);
  });

  it('handles a transaction with no token balance changes at all', () => {
    const result = parsePaymentTransaction(
      'sig7',
      buildTx({ meta: { err: null, preTokenBalances: [], postTokenBalances: [] } }),
      USDC_MINT
    );

    expect(result.transfers).toEqual([]);
  });
});
