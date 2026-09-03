import type { AvatarBorderStyle } from '../types';

// Fixed, tasteful presets only -- never an arbitrary gradient string (see
// AvatarBorderStyle and its DB check constraint). Two-stop, closely related
// hues per preset so the ring reads as premium and restrained rather than
// a loud rainbow. Shared between UserAvatar (rendering the ring) and
// AvatarBorderPicker (choosing one) so the two never drift apart.
export const AVATAR_GRADIENT_PRESETS: Record<Exclude<AvatarBorderStyle, 'none'>, [string, string]> = {
  lime: ['#C7F500', '#7CB342'],
  aurora: ['#00E5A0', '#4AC8F0'],
  sunset: ['#FF7A59', '#FFC371'],
  ocean: ['#00C6FB', '#005BEA'],
  violet: ['#8E2DE2', '#B06AB3'],
};

export const AVATAR_BORDER_STYLE_ORDER: AvatarBorderStyle[] = ['none', 'lime', 'aurora', 'sunset', 'ocean', 'violet'];

export const AVATAR_BORDER_STYLE_LABELS: Record<AvatarBorderStyle, string> = {
  none: 'None',
  lime: 'Lime',
  aurora: 'Aurora',
  sunset: 'Sunset',
  ocean: 'Ocean',
  violet: 'Violet',
};
