import { isValidSolanaAddress } from '../services/blockchain/solana/walletValidation';

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}

// Delegates to a real base58/PublicKey decode check (not just a shape
// regex) — see src/services/blockchain/solana/walletValidation.ts.
export function isValidWalletAddress(address: string): boolean {
  return isValidSolanaAddress(address);
}
