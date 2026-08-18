import type { ColorSchemeName } from 'react-native';
import type { ThemePreference } from '../types';

export type ResolvedThemeMode = 'light' | 'dark';

export function resolveThemeMode(
  preference: ThemePreference | null,
  deviceScheme: ColorSchemeName | null
): ResolvedThemeMode {
  if (preference === null) return 'light';
  if (preference === 'system') return deviceScheme === 'dark' ? 'dark' : 'light';
  return preference;
}
