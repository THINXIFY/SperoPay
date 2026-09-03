import type { ParsedTransactionWithMeta, SignatureStatus } from '@solana/web3.js';
import { findPaymentForRequest } from '../findPaymentForRequest';
import type { SolanaRpcProvider, SolanaSignatureDiscoveryProvider } from '../client';
import type { ExpectedPayment } from '../types';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MERCHANT_WALLET = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
const PAYER_WALLET = '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu';
const REFERENCE = 'GsbwXfJraMomNxBcpR5TVQaaB6WcU9v4rTUgHTKfyG3g';

function pubkey(address: string) {
  return { pubkey: { toBase58: () => address } };
}

function fakeTx(overrides: { amount?: string; mint?: string; owner?: string; err?: unknown } = {}): ParsedTransactionWithMeta {
  const { amount = '10500000', mint = USDC_MINT, owner = MERCHANT_WALLET, err = null } = overrides;
  return {
    slot: 1,
    blockTime: 1_700_000_000,
    transaction: { message: { accountKeys: [pubkey(PAYER_WALLET), pubkey('tokenAccount1')] } },
    meta: {
      err,
      preTokenBalances: [
        { accountIndex: 1, mint, owner, uiTokenAmount: { amount: '0', decimals: 6, uiAmount: 0 } },
      ],
      postTokenBalances: [
        { accountIndex: 1, mint, owner, uiTokenAmount: { amount, decimals: 6, uiAmount: Number(amount) / 1e6 } },
      ],
    },
  } as unknown as ParsedTransactionWithMeta;
}

function confirmedStatus(): SignatureStatus {
  return { slot: 1, confirmations: 10, err: null, confirmationStatus: 'confirmed' } as unknown as SignatureStatus;
}

function processedStatus(): SignatureStatus {
  return { slot: 1, confirmations: 1, err: null, confirmationStatus: 'processed' } as unknown as SignatureStatus;
}

const expected: ExpectedPayment = {
  network: 'mainnet-beta',
  usdcMint: USDC_MINT,
  destinationWallet: MERCHANT_WALLET,
  amountBaseUnits: 10_500_000n,
  notAfter: null,
};

function discoveryProvider(signatures: string[]): SolanaSignatureDiscoveryProvider {
  return { getSignaturesForAddress: jest.fn().mockResolvedValue(signatures) };
}

describe('findPaymentForRequest', () => {
  it('returns no_match when discovery finds no signatures at all for the reference', async () => {
    const rpcProvider: SolanaRpcProvider = { getParsedTransaction: jest.fn(), getSignatureStatus: jest.fn() };

    const outcome = await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discoveryProvider([]),
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false),
    });

    expect(outcome).toEqual({ kind: 'no_match' });
    expect(rpcProvider.getParsedTransaction).not.toHaveBeenCalled();
  });

  it('returns paid with the verified result for a valid, confirmed, unused match', async () => {
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeTx()),
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };

    const outcome = await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discoveryProvider(['sig-1']),
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false),
    });

    expect(outcome).toEqual({
      kind: 'paid',
      result: { valid: true, signature: 'sig-1', amountBaseUnits: 10_500_000n, blockTime: 1_700_000_000 },
    });
  });

  it('returns confirming when the matching transaction exists but is not yet confirmed enough', async () => {
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeTx()),
      getSignatureStatus: jest.fn().mockResolvedValue(processedStatus()),
    };

    const outcome = await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discoveryProvider(['sig-1']),
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false),
    });

    expect(outcome).toEqual({ kind: 'confirming' });
  });

  it('returns no_match (not confirming or paid) for a candidate with the wrong amount', async () => {
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeTx({ amount: '1' })),
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };

    const outcome = await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discoveryProvider(['sig-1']),
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false),
    });

    expect(outcome).toEqual({ kind: 'no_match', lastReason: 'wrong_amount' });
  });

  it('returns no_match for a candidate with the wrong token mint', async () => {
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeTx({ mint: 'SomeOtherMint11111111111111111111111111111' })),
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };

    const outcome = await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discoveryProvider(['sig-1']),
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false),
    });

    expect(outcome).toEqual({ kind: 'no_match', lastReason: 'wrong_mint' });
  });

  it('returns no_match for a candidate paid to the wrong merchant wallet', async () => {
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeTx({ owner: 'NotTheMerchant1111111111111111111111111111' })),
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };

    const outcome = await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discoveryProvider(['sig-1']),
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false),
    });

    expect(outcome).toEqual({ kind: 'no_match', lastReason: 'wrong_destination' });
  });

  it('returns no_match for a candidate whose transaction failed on-chain', async () => {
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeTx({ err: { InstructionError: [0, 'Custom'] } })),
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };

    const outcome = await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discoveryProvider(['sig-1']),
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false),
    });

    expect(outcome).toEqual({ kind: 'no_match', lastReason: 'transaction_failed' });
  });

  it('returns no_match (never re-confirming) for a signature already credited elsewhere', async () => {
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeTx()),
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };

    const outcome = await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discoveryProvider(['sig-1']),
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn().mockResolvedValue(true),
    });

    expect(outcome).toEqual({ kind: 'no_match', lastReason: 'already_credited' });
  });

  it('checks candidates in order and returns paid on the first valid one, ignoring an earlier wrong candidate', async () => {
    const getParsedTransaction = jest
      .fn()
      .mockResolvedValueOnce(fakeTx({ amount: '1' })) // sig-1: wrong amount
      .mockResolvedValueOnce(fakeTx()); // sig-2: valid
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction,
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };

    const outcome = await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discoveryProvider(['sig-1', 'sig-2']),
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false),
    });

    expect(outcome.kind).toBe('paid');
    expect(getParsedTransaction).toHaveBeenCalledTimes(2);
  });

  it('reports rpc_unavailable (does not throw) when discovery itself fails', async () => {
    const discovery: SolanaSignatureDiscoveryProvider = {
      getSignaturesForAddress: jest.fn().mockRejectedValue(new Error('RPC down')),
    };
    const rpcProvider: SolanaRpcProvider = { getParsedTransaction: jest.fn(), getSignatureStatus: jest.fn() };

    const outcome = await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discovery,
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn(),
    });

    expect(outcome).toEqual({ kind: 'rpc_unavailable' });
  });

  it('does not retry discovery indefinitely', async () => {
    const getSignaturesForAddress = jest.fn().mockRejectedValue(new Error('always fails'));
    const discovery: SolanaSignatureDiscoveryProvider = { getSignaturesForAddress };
    const rpcProvider: SolanaRpcProvider = { getParsedTransaction: jest.fn(), getSignatureStatus: jest.fn() };

    await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discovery,
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn(),
    });

    expect(getSignaturesForAddress.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('pages backward with `before` when a full first page has no match, and finds the payment on the next page', async () => {
    // Simulates a griefing attempt: enough newer, irrelevant signatures to
    // fill the first page, with the real payment further back in history.
    const getSignaturesForAddress = jest
      .fn()
      .mockResolvedValueOnce(['spam-1', 'spam-2'])
      .mockResolvedValueOnce(['sig-real']);
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockImplementation((sig: string) =>
        Promise.resolve(sig === 'sig-real' ? fakeTx() : fakeTx({ amount: '1' }))
      ),
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };

    const outcome = await findPaymentForRequest(
      REFERENCE,
      expected,
      { discoveryProvider: { getSignaturesForAddress }, rpcProvider, isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false) },
      2
    );

    expect(outcome.kind).toBe('paid');
    expect(getSignaturesForAddress).toHaveBeenCalledTimes(2);
    expect(getSignaturesForAddress).toHaveBeenNthCalledWith(1, REFERENCE, 2, undefined);
    expect(getSignaturesForAddress).toHaveBeenNthCalledWith(2, REFERENCE, 2, 'spam-2');
  });

  it('stops paging once a page comes back shorter than the limit (reached the real end of history)', async () => {
    const getSignaturesForAddress = jest.fn().mockResolvedValue(['sig-1', 'sig-2']); // shorter than limit=5
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeTx({ amount: '1' })), // never matches
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };

    const outcome = await findPaymentForRequest(
      REFERENCE,
      expected,
      { discoveryProvider: { getSignaturesForAddress }, rpcProvider, isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false) },
      5
    );

    expect(outcome).toEqual({ kind: 'no_match', lastReason: 'wrong_amount' });
    expect(getSignaturesForAddress).toHaveBeenCalledTimes(1);
  });

  it('caps total pages fetched even if every page is full and contains no match (never unbounded)', async () => {
    const getSignaturesForAddress = jest.fn().mockResolvedValue(['a', 'b']); // always a "full" page of 2
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeTx({ amount: '1' })), // never matches
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };

    const outcome = await findPaymentForRequest(
      REFERENCE,
      expected,
      { discoveryProvider: { getSignaturesForAddress }, rpcProvider, isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false) },
      2
    );

    expect(outcome).toEqual({ kind: 'no_match', lastReason: 'wrong_amount' });
    expect(getSignaturesForAddress).toHaveBeenCalledTimes(3); // MAX_PAGES, not unbounded
  });

  it('skips a candidate that throws unexpectedly (malformed chain data) and still finds a valid one after it', async () => {
    const getParsedTransaction = jest
      .fn()
      .mockResolvedValueOnce(fakeTx({ amount: 'not-a-number' })) // sig-bad: BigInt() throws inside parsePaymentTransaction
      .mockResolvedValueOnce(fakeTx()); // sig-good: valid
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction,
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };

    const outcome = await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discoveryProvider(['sig-bad', 'sig-good']),
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false),
    });

    expect(outcome.kind).toBe('paid');
    expect(getParsedTransaction).toHaveBeenCalledTimes(2);
  });

  it('reports the last failure reason on no_match, useful for server-side logging', async () => {
    const rpcProvider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeTx({ amount: '1' })), // wrong amount
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };

    const outcome = await findPaymentForRequest(REFERENCE, expected, {
      discoveryProvider: discoveryProvider(['sig-1']),
      rpcProvider,
      isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false),
    });

    expect(outcome).toEqual({ kind: 'no_match', lastReason: 'wrong_amount' });
  });

  it('the overall time budget is a genuine deadline, not just a between-steps check -- it cuts off a single candidate stuck mid-verification', async () => {
    jest.useFakeTimers();
    try {
      // Neither RPC call ever resolves on its own -- simulates the exact
      // scenario the budget exists for: a single candidate whose own
      // internal retry/timeout logic (up to ~30s worst case, longer than
      // the 20s overall budget) is still running. A between-steps-only
      // check could never interrupt this; only a real race can.
      const rpcProvider: SolanaRpcProvider = {
        getParsedTransaction: jest.fn(() => new Promise(() => {})),
        getSignatureStatus: jest.fn(() => new Promise(() => {})),
      };

      const outcomePromise = findPaymentForRequest(REFERENCE, expected, {
        discoveryProvider: discoveryProvider(['sig-1']),
        rpcProvider,
        isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false),
      });

      // Advances past OVERALL_BUDGET_MS (20s) but well short of the stuck
      // call's own eventual ~30s timeout -- if the deadline weren't a real
      // race, this outcome would still be unresolved at this point.
      await jest.advanceTimersByTimeAsync(20_000);

      await expect(outcomePromise).resolves.toEqual({ kind: 'no_match', lastReason: undefined });
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('the deadline reports confirming, not no_match, if an earlier candidate already showed insufficient confirmation', async () => {
    jest.useFakeTimers();
    try {
      const getParsedTransaction = jest
        .fn()
        .mockResolvedValueOnce(fakeTx()) // sig-1: matches, but...
        .mockImplementationOnce(() => new Promise(() => {})); // sig-2: stuck
      const rpcProvider: SolanaRpcProvider = {
        getParsedTransaction,
        getSignatureStatus: jest
          .fn()
          .mockResolvedValueOnce(processedStatus()) // sig-1: found, not yet confirmed
          .mockImplementationOnce(() => new Promise(() => {})),
      };

      const outcomePromise = findPaymentForRequest(REFERENCE, expected, {
        discoveryProvider: discoveryProvider(['sig-1', 'sig-2']),
        rpcProvider,
        isSignatureAlreadyUsed: jest.fn().mockResolvedValue(false),
      });

      await jest.advanceTimersByTimeAsync(20_000);

      // sig-1 already proved the real payment exists and is just not
      // confirmed enough yet -- the deadline must report that, not treat
      // the whole attempt as "found nothing" just because sig-2 never
      // finished.
      await expect(outcomePromise).resolves.toEqual({ kind: 'confirming' });
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
