import { PublicKey } from '@solana/web3.js';

// PublicKey's constructor throws on anything that isn't a valid
// base58-encoded 32-byte value, which is stronger than a regex shape-check
// (a regex alone accepts any base58-looking 32-44 char string without
// confirming it actually decodes to a real key). src/utils/validators.ts's
// isValidWalletAddress delegates straight to this function -- every wallet
// entry point in the app (onboarding, Wallet Settings) already gets the
// real check, not a shape-only one. Merchant wallets remain receiving-only
// configuration here — this never requests or touches a private key/seed
// phrase, only validates a public address.
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
