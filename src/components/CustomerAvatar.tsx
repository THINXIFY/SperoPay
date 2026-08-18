import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { Customer } from '../types';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export function CustomerAvatar({ name, color, size = 44 }: { name: string; color: Customer['avatarColor']; size?: number }) {
  const { colors, radius, typography } = useTheme();
  const bg = colors[`soft${capitalize(color)}` as keyof typeof colors] as string;
  const text = colors[`soft${capitalize(color)}Text` as keyof typeof colors] as string;

  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radius.full, backgroundColor: bg },
      ]}
    >
      <Text style={[typography.caption, { color: text, fontSize: size * 0.36 }]}>{getInitials(name)}</Text>
    </View>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
