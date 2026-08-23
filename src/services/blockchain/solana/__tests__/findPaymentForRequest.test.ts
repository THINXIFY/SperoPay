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

    expect(outcome).toEqual({ kind: 'no_match' });
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

    expect(outcome).toEqual({ kind: 'no_match' });
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

    expect(outcome).toEqual({ kind: 'no_match' });
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

    expect(outcome).toEqual({ kind: 'no_match' });
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

    expect(outcome).toEqual({ kind: 'no_match' });
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
});
