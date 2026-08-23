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

const expected: ExpectedPayment = {
  network: 'devnet',
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
});
