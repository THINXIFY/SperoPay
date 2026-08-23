import { Connection, PublicKey } from '@solana/web3.js';
import type { ParsedTransactionWithMeta, SignatureStatus } from '@solana/web3.js';
import { getSolanaRpcUrl, REQUIRED_CONFIRMATION_LEVEL } from './config.ts';

// Narrow interface around the handful of RPC calls this app actually
// needs — deliberately not "the whole Connection object" — so a caller can
// swap in a different provider (Helius/QuickNode/Alchemy, or a mock for
// tests) without touching any domain logic in transactionParser.ts /
// paymentVerifier.ts / paymentMatcher.ts. See design doc Decision 1.
export interface SolanaRpcProvider {
  getParsedTransaction(signature: string): Promise<ParsedTransactionWithMeta | null>;
  getSignatureStatus(signature: string): Promise<SignatureStatus | null>;
}

// Separate, narrower interface (Phase 3D): finding which transaction(s)
// touched a Solana Pay reference account. Kept apart from SolanaRpcProvider
// on purpose -- matchPayment() and its existing tests only need the two
// methods above, given an already-known signature; only the discovery step
// that runs *before* matchPayment (finding a candidate signature in the
// first place) needs this.
export interface SolanaSignatureDiscoveryProvider {
  /** Most-recent-first, like the underlying RPC call. */
  getSignaturesForAddress(address: string, limit?: number): Promise<string[]>;
}

export class PublicRpcProvider implements SolanaRpcProvider, SolanaSignatureDiscoveryProvider {
  private readonly connection: Connection;

  constructor(rpcUrl: string = getSolanaRpcUrl()) {
    this.connection = new Connection(rpcUrl, REQUIRED_CONFIRMATION_LEVEL);
  }

  async getParsedTransaction(signature: string): Promise<ParsedTransactionWithMeta | null> {
    return this.connection.getParsedTransaction(signature, {
      commitment: REQUIRED_CONFIRMATION_LEVEL,
      maxSupportedTransactionVersion: 0,
    });
  }

  async getSignatureStatus(signature: string): Promise<SignatureStatus | null> {
    const response = await this.connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    return response.value;
  }

  async getSignaturesForAddress(address: string, limit = 10): Promise<string[]> {
    const infos = await this.connection.getSignaturesForAddress(new PublicKey(address), { limit });
    return infos.map((info) => info.signature);
  }
}
