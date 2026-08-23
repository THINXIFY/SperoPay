import { PublicKey } from '@solana/web3.js';

// The app's existing isValidWalletAddress (src/utils/validators.ts) is a
// regex shape-check only — it accepts any base58-looking 32-44 char string
// without confirming it actually decodes to a 32-byte key. PublicKey's
// constructor throws on anything that isn't a valid base58-encoded 32-byte
// value, which is the real validation spec section 10 asks for. Merchant
// wallets remain receiving-only configuration here — this never requests
// or touches a private key/seed phrase, only validates a public address.
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
