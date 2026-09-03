export const lightColors = {
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
  // Modal/lightbox scrims -- deliberately the same dark value in both
  // palettes (a backdrop dims whatever's behind it regardless of the
  // active theme), so this is a real token rather than a per-screen
  // hardcoded rgba() literal.
  overlay: 'rgba(5, 5, 5, 0.5)',
  overlayStrong: 'rgba(5, 5, 5, 0.85)',
  // Secondary text on top of heroSurface specifically -- heroSurface is a
  // near-black card in BOTH themes (see heroSurface/heroSurfaceText above),
  // so its muted text needs to be derived from heroSurfaceText, not from the
  // page-level textMuted/textSecondary tokens (which are calibrated against
  // the light background / dark surface, not this always-dark card, and fall
  // well under WCAG AA contrast when used on it in dark mode).
  heroSurfaceTextMuted: 'rgba(255, 255, 255, 0.62)',
  // Same rationale as heroSurfaceTextMuted above -- heroSurface is
  // near-black in BOTH themes, so a hairline/tint drawn on top of it is
  // derived from a fixed white/lime translucency rather than the
  // page-level border/primaryAction tokens (calibrated for a light
  // background or dark surface, not this always-dark card).
  heroSurfaceBorder: 'rgba(255, 255, 255, 0.12)',
  primaryActionSoft: 'rgba(199, 245, 0, 0.16)',
} as const;

export type ThemeColors = Readonly<Record<keyof typeof lightColors, string>>;

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
  overlay: 'rgba(5, 5, 5, 0.5)',
  overlayStrong: 'rgba(5, 5, 5, 0.85)',
  heroSurfaceTextMuted: 'rgba(255, 255, 255, 0.62)',
  heroSurfaceBorder: 'rgba(255, 255, 255, 0.12)',
  primaryActionSoft: 'rgba(199, 245, 0, 0.16)',
};
