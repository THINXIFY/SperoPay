import { createContext, useContext } from 'react';
import { lightColors, darkColors, type ThemeColors } from './colors';
import { spacing, radius } from './spacing';
import { typography } from './typography';
import type { ResolvedThemeMode } from './resolveThemeMode';

export interface ThemeContextValue {
  mode: ResolvedThemeMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: lightColors,
  spacing,
  radius,
  typography,
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export { lightColors, darkColors };
