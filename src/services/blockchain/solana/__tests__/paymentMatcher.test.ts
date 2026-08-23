import type { ParsedTransactionWithMeta, SignatureStatus } from '@solana/web3.js';
import { matchPayment } from '../paymentMatcher';
import type { SolanaRpcProvider } from '../client';
import type { ExpectedPayment } from '../types';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MERCHANT_WALLET = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
const PAYER_WALLET = '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu';

function pubkey(address: string) {
  return { pubkey: { toBase58: () => address } };
}

function fakeSuccessfulTx(): ParsedTransactionWithMeta {
  return {
    slot: 1,
    blockTime: 1_700_000_000,
    transaction: { message: { accountKeys: [pubkey(PAYER_WALLET), pubkey('tokenAccount1')] } },
    meta: {
      err: null,
      preTokenBalances: [
        { accountIndex: 1, mint: USDC_MINT, owner: MERCHANT_WALLET, uiTokenAmount: { amount: '0', decimals: 6, uiAmount: 0 } },
      ],
      postTokenBalances: [
        {
          accountIndex: 1,
          mint: USDC_MINT,
          owner: MERCHANT_WALLET,
          uiTokenAmount: { amount: '10500000', decimals: 6, uiAmount: 10.5 },
        },
      ],
    },
  } as unknown as ParsedTransactionWithMeta;
}

// USDC_MINT above is the real mainnet mint address, so `expected` must
// consistently claim mainnet-beta -- matchPayment now asserts the two
// agree (see the "mismatched" test below for the case where they don't).
const expected: ExpectedPayment = {
  network: 'mainnet-beta',
  usdcMint: USDC_MINT,
  destinationWallet: MERCHANT_WALLET,
  amountBaseUnits: 10_500_000n,
  notAfter: null,
};

function confirmedStatus(): SignatureStatus {
  return { slot: 1, confirmations: 10, err: null, confirmationStatus: 'confirmed' } as unknown as SignatureStatus;
}

describe('matchPayment', () => {
  it('verifies a real, confirmed, unused payment', async () => {
    const provider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeSuccessfulTx()),
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };
    const isSignatureAlreadyUsed = jest.fn().mockResolvedValue(false);

    const result = await matchPayment('sig-1', expected, { rpcProvider: provider, isSignatureAlreadyUsed });

    expect(result).toEqual({
      valid: true,
      signature: 'sig-1',
      amountBaseUnits: 10_500_000n,
      blockTime: 1_700_000_000,
    });
    expect(isSignatureAlreadyUsed).toHaveBeenCalledWith('sig-1');
  });

  it('rejects a signature already credited to another request, without even needing to re-check the chain data', async () => {
    const provider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeSuccessfulTx()),
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };
    const isSignatureAlreadyUsed = jest.fn().mockResolvedValue(true);

    const result = await matchPayment('sig-1', expected, { rpcProvider: provider, isSignatureAlreadyUsed });

    expect(result).toEqual({ valid: false, reason: 'already_credited' });
  });

  it('reports rpc_unavailable when the provider keeps failing (does not throw)', async () => {
    const provider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockRejectedValue(new Error('network down')),
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };
    const isSignatureAlreadyUsed = jest.fn().mockResolvedValue(false);

    const result = await matchPayment('sig-1', expected, { rpcProvider: provider, isSignatureAlreadyUsed });

    expect(result).toEqual({ valid: false, reason: 'rpc_unavailable' });
  });

  it('retries a transient RPC failure once before giving up (spec: not indefinite, but not zero-tolerance either)', async () => {
    const getParsedTransaction = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(fakeSuccessfulTx());
    const provider: SolanaRpcProvider = {
      getParsedTransaction,
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };
    const isSignatureAlreadyUsed = jest.fn().mockResolvedValue(false);

    const result = await matchPayment('sig-1', expected, { rpcProvider: provider, isSignatureAlreadyUsed });

    expect(result.valid).toBe(true);
    expect(getParsedTransaction).toHaveBeenCalledTimes(2);
  });

  it('does not retry indefinitely -- gives up after a bounded number of attempts', async () => {
    const getParsedTransaction = jest.fn().mockRejectedValue(new Error('always fails'));
    const provider: SolanaRpcProvider = {
      getParsedTransaction,
      getSignatureStatus: jest.fn().mockResolvedValue(confirmedStatus()),
    };
    const isSignatureAlreadyUsed = jest.fn().mockResolvedValue(false);

    const result = await matchPayment('sig-1', expected, { rpcProvider: provider, isSignatureAlreadyUsed });

    expect(result).toEqual({ valid: false, reason: 'rpc_unavailable' });
    expect(getParsedTransaction.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('treats an unrecognized confirmationStatus string as insufficient confirmation, not as passing the gate', async () => {
    // The status string comes from whatever endpoint EXPO_PUBLIC_SOLANA_RPC_URL
    // points at -- an unchecked cast plus a Record lookup would make an
    // unrecognized value compare as "less than every real level" by
    // accident (undefined < N is false), silently clearing the gate. This
    // locks in that an unrecognized value fails closed instead.
    const provider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn().mockResolvedValue(fakeSuccessfulTx()),
      getSignatureStatus: jest
        .fn()
        .mockResolvedValue({ slot: 1, confirmations: 10, err: null, confirmationStatus: 'not-a-real-level' } as unknown as SignatureStatus),
    };
    const isSignatureAlreadyUsed = jest.fn().mockResolvedValue(false);

    const result = await matchPayment('sig-1', expected, { rpcProvider: provider, isSignatureAlreadyUsed });

    expect(result).toEqual({ valid: false, reason: 'insufficient_confirmation' });
  });

  it('throws synchronously if the caller constructs an ExpectedPayment whose mint does not match its own network', async () => {
    const provider: SolanaRpcProvider = {
      getParsedTransaction: jest.fn(),
      getSignatureStatus: jest.fn(),
    };
    const mismatched: ExpectedPayment = { ...expected, network: 'devnet' }; // usdcMint is still the mainnet mint

    await expect(
      matchPayment('sig-1', mismatched, { rpcProvider: provider, isSignatureAlreadyUsed: jest.fn() })
    ).rejects.toThrow(/does not match the USDC mint configured for/);
    expect(provider.getParsedTransaction).not.toHaveBeenCalled();
  });
});
