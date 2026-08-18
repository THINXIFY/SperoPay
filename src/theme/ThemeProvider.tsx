import React, { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeContext } from './useTheme';
import { lightColors, darkColors } from './colors';
import { spacing, radius } from './spacing';
import { typography } from './typography';
import { resolveThemeMode } from './resolveThemeMode';
import { useThemeStore } from '../store/themeStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useThemeStore((state) => state.preference);
  const deviceScheme = useColorScheme();

  const value = useMemo(() => {
    const mode = resolveThemeMode(preference, deviceScheme);
    return {
      mode,
      colors: mode === 'dark' ? darkColors : lightColors,
      spacing,
      radius,
      typography,
    };
  }, [preference, deviceScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
