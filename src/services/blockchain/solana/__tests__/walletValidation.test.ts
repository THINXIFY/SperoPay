import { isValidSolanaAddress } from '../walletValidation';

describe('isValidSolanaAddress', () => {
  it('accepts a real, genuinely-decodable 32-byte base58 address', () => {
    expect(isValidSolanaAddress('7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu')).toBe(true);
  });

  it('accepts the well-known mainnet USDC mint address', () => {
    expect(isValidSolanaAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidSolanaAddress('')).toBe(false);
  });

  it('rejects a string containing invalid base58 characters', () => {
    // '0', 'O', 'I', 'l' are excluded from the base58 alphabet
    expect(isValidSolanaAddress('0OIl1111111111111111111111111111')).toBe(false);
  });

  it('rejects a base58 string that decodes to the wrong byte length', () => {
    // Shape-plausible (right charset) but not a real 32-byte key -- this is
    // exactly the class of input the old regex-only check would have wrongly
    // accepted.
    expect(isValidSolanaAddress('abc')).toBe(false);
  });

  it('rejects a plainly non-address string', () => {
    expect(isValidSolanaAddress('not a wallet address')).toBe(false);
  });
});
