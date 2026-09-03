import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { getInitials } from '../utils/getInitials';
import type { Customer } from '../types';

interface CustomerAvatarProps {
  name: string;
  color: Customer['avatarColor'];
  size?: number;
  avatarUrl?: string;
  imageType?: Customer['imageType'];
}

export function CustomerAvatar({ name, color, size = 44, avatarUrl, imageType }: CustomerAvatarProps) {
  const { colors, radius, typography } = useTheme();
  const bg = colors[`soft${capitalize(color)}` as keyof typeof colors] as string;
  const text = colors[`soft${capitalize(color)}Text` as keyof typeof colors] as string;

  // Resets on a genuine image change (a new upload, a removal) so a prior
  // load failure doesn't permanently hide a since-replaced, perfectly
  // loadable image.
  const [hasImageError, setHasImageError] = useState(false);
  useEffect(() => setHasImageError(false), [avatarUrl]);

  if (avatarUrl && !hasImageError) {
    // Logos get a clean rounded-square, contain-fit treatment so the full
    // mark is never cropped; individual photos stay circular and cover-fit,
    // matching the initials fallback's shape.
    const isLogo = imageType === 'logo';
    return (
      <View
        style={[
          styles.base,
          {
            width: size,
            height: size,
            borderRadius: isLogo ? radius.md : radius.full,
            backgroundColor: isLogo ? colors.surface : bg,
            borderWidth: isLogo ? 1 : 0,
            borderColor: colors.border,
            overflow: 'hidden',
          },
        ]}
      >
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size }}
          resizeMode={isLogo ? 'contain' : 'cover'}
          onError={() => setHasImageError(true)}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radius.full, backgroundColor: bg },
      ]}
    >
      <Text style={[typography.caption, { color: text, fontSize: size * 0.36, lineHeight: size * 0.36 * 1.2 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
