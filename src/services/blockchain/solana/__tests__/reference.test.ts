import { generateSolanaReference } from '../reference';
import { isValidSolanaAddress } from '../walletValidation';

describe('generateSolanaReference', () => {
  it('produces a valid Solana public key', () => {
    const reference = generateSolanaReference();
    expect(isValidSolanaAddress(reference)).toBe(true);
  });

  it('produces a unique value on every call', () => {
    const seen = new Set(Array.from({ length: 20 }, () => generateSolanaReference()));
    expect(seen.size).toBe(20);
  });

  it('never returns the payment_code-style identifier', () => {
    const reference = generateSolanaReference();
    expect(reference).not.toMatch(/^SP-/);
  });
});
