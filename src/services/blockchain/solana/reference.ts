import { Keypair } from '@solana/web3.js';

// A Solana Pay "reference" is only ever used as a read-only account key a
// wallet includes in the payment transaction, so a merchant/indexer can
// later find that transaction via getSignaturesForAddress(reference). It is
// never signed with and never needs to be signed with, so the standard
// pattern (recommended by Solana Pay itself) is to generate a throwaway
// keypair and keep only the public key -- the secret half is never read
// off the returned Keypair, never logged, and never persisted anywhere.
export function generateSolanaReference(): string {
  return Keypair.generate().publicKey.toBase58();
}
