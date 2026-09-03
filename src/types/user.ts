export interface User {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

export type UsageType = 'freelancer' | 'business' | 'creator' | 'personal';

// A fixed, stable set of ring identifiers -- never an arbitrary gradient
// CSS/color string (see supabase/migrations/0008_profile_customer_images.sql,
// enforced there too via a check constraint, not just this type).
export type AvatarBorderStyle = 'none' | 'lime' | 'aurora' | 'sunset' | 'ocean' | 'violet';

export interface Profile {
  usageType: UsageType | null;
  displayName: string;
  businessName?: string;
  country: string;
  website?: string;
  avatarUri?: string;
  avatarBorderStyle: AvatarBorderStyle;
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
