type ColorShape = {
  readonly background: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly heroSurface: string;
  readonly heroSurfaceText: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly border: string;
  readonly primaryAction: string;
  readonly primaryActionPressed: string;
  readonly primaryActionText: string;
  readonly tabBarBackground: string;
  readonly tabBarIcon: string;
  readonly tabBarIconMuted: string;
  readonly tabBarIconActive: string;
  readonly softMint: string;
  readonly softMintText: string;
  readonly softLavender: string;
  readonly softLavenderText: string;
  readonly softBlue: string;
  readonly softBlueText: string;
  readonly softRed: string;
  readonly softRedText: string;
  readonly success: string;
  readonly pending: string;
  readonly error: string;
  readonly expired: string;
};

export type ThemeColors = ColorShape;

export const lightColors: ThemeColors = {
  background: '#F5F6F4',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  heroSurface: '#050505',
  heroSurfaceText: '#FFFFFF',
  textPrimary: '#0A0A0A',
  textSecondary: '#707070',
  textMuted: '#A1A1A1',
  border: '#E7E7E4',
  primaryAction: '#C7F500',
  primaryActionPressed: '#B2DD00',
  primaryActionText: '#050505',
  tabBarBackground: '#050505',
  tabBarIcon: '#FFFFFF',
  tabBarIconMuted: '#8A8A8A',
  tabBarIconActive: '#C7F500',
  softMint: '#DDF7E7',
  softMintText: '#0F5132',
  softLavender: '#DDD8FF',
  softLavenderText: '#3B2E8C',
  softBlue: '#E4F3FF',
  softBlueText: '#0B4C7A',
  softRed: '#FFE8E8',
  softRedText: '#8C2222',
  success: '#22C55E',
  pending: '#F59E0B',
  error: '#EF4444',
  expired: '#D9848E',
} as const;

export const darkColors: ThemeColors = {
  background: '#050505',
  surface: '#111111',
  surfaceRaised: '#191919',
  heroSurface: '#191919',
  heroSurfaceText: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#A8A8A8',
  textMuted: '#707070',
  border: '#292929',
  primaryAction: '#C7F500',
  primaryActionPressed: '#B2DD00',
  primaryActionText: '#050505',
  tabBarBackground: '#050505',
  tabBarIcon: '#FFFFFF',
  tabBarIconMuted: '#6E6E6E',
  tabBarIconActive: '#C7F500',
  softMint: '#16281E',
  softMintText: '#7FE3AA',
  softLavender: '#211D3A',
  softLavenderText: '#B7ACFF',
  softBlue: '#132330',
  softBlueText: '#8FCBFF',
  softRed: '#2E1717',
  softRedText: '#FF9E9E',
  success: '#22C55E',
  pending: '#F59E0B',
  error: '#EF4444',
  expired: '#D9848E',
};
