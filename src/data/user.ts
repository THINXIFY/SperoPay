import type { User, Profile, Wallet } from '../types';

export const mockUser: User = {
  id: 'user-farhan',
  fullName: 'Farhan Z.',
  email: 'thinxify@gmail.com',
  createdAt: '2026-06-01T09:00:00.000Z',
};

export const mockProfile: Profile = {
  usageType: 'business',
  displayName: 'Farhan Z.',
  businessName: 'THINXIFY',
  country: 'United Arab Emirates',
  website: 'https://thinxify.app',
  onboardingCompleted: true,
};

export const mockWallet: Wallet = {
  stablecoin: 'USDC',
  network: 'Solana',
  address: '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu',
};
