import type { ColorSchemeName } from 'react-native';

type ThemePreferenceInput = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

export function resolveThemeMode(
  preference: ThemePreferenceInput | null,
  deviceScheme: ColorSchemeName | null
): ResolvedThemeMode {
  if (preference === null) return 'light';
  if (preference === 'system') return deviceScheme === 'dark' ? 'dark' : 'light';
  return preference;
}
