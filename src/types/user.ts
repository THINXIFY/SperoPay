export interface User {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

export type UsageType = 'freelancer' | 'business' | 'creator' | 'personal';

export interface Profile {
  usageType: UsageType | null;
  displayName: string;
  businessName?: string;
  country: string;
  website?: string;
  avatarUri?: string;
  businessEmail?: string;
  businessDescription?: string;
  businessLogoUri?: string;
  onboardingCompleted: boolean;
}

export interface Wallet {
  stablecoin: 'USDC';
  network: 'Solana';
  address: string;
}
