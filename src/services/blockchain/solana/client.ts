import { Connection, ParsedTransactionWithMeta, SignatureStatus } from '@solana/web3.js';
import { getSolanaRpcUrl, REQUIRED_CONFIRMATION_LEVEL } from './config';

// Narrow interface around the handful of RPC calls this app actually
// needs — deliberately not "the whole Connection object" — so a caller can
// swap in a different provider (Helius/QuickNode/Alchemy, or a mock for
// tests) without touching any domain logic in transactionParser.ts /
// paymentVerifier.ts / paymentMatcher.ts. See design doc Decision 1.
export interface SolanaRpcProvider {
  getParsedTransaction(signature: string): Promise<ParsedTransactionWithMeta | null>;
  getSignatureStatus(signature: string): Promise<SignatureStatus | null>;
}

export class PublicRpcProvider implements SolanaRpcProvider {
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
}
