import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

export function Logo({ size = 64 }: { size?: number }) {
  const { colors, radius } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius.lg,
          backgroundColor: colors.heroSurface,
        },
      ]}
    >
      <Text style={[styles.glyph, { fontSize: size * 0.42, color: colors.heroSurfaceText }]}>S</Text>
      <View
        style={[
          styles.arrow,
          { width: size * 0.22, height: size * 0.22, borderRadius: radius.full, backgroundColor: colors.primaryAction },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  glyph: { fontFamily: 'PlusJakartaSans_800ExtraBold' },
  arrow: { position: 'absolute', bottom: 6, right: 6 },
});
