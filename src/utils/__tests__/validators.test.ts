import { isValidEmail, isValidPassword, isValidAmount, isValidWalletAddress } from '../validators';

describe('isValidEmail', () => {
  it('accepts well-formed emails', () => {
    expect(isValidEmail('john@doe.com')).toBe(true);
  });
  it('rejects malformed emails', () => {
    expect(isValidEmail('john@doe')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('accepts passwords with at least 8 characters', () => {
    expect(isValidPassword('password123')).toBe(true);
  });
  it('rejects passwords under 8 characters', () => {
    expect(isValidPassword('short1')).toBe(false);
  });
});

describe('isValidAmount', () => {
  it('accepts positive amounts', () => {
    expect(isValidAmount(750)).toBe(true);
    expect(isValidAmount(0.5)).toBe(true);
  });
  it('rejects zero or negative amounts', () => {
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(-10)).toBe(false);
  });
});

describe('isValidWalletAddress', () => {
  it('accepts a plausible base58 Solana address', () => {
    expect(isValidWalletAddress('7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu')).toBe(true);
  });
  it('rejects addresses that are too short or contain invalid characters', () => {
    expect(isValidWalletAddress('short')).toBe(false);
    expect(isValidWalletAddress('0OIl-invalid-chars-000000000000000000000')).toBe(false);
    expect(isValidWalletAddress('')).toBe(false);
  });
});
