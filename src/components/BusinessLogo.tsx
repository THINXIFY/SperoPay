import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { getInitials } from '../utils/getInitials';

interface BusinessLogoProps {
  name: string;
  logoUrl?: string | null;
  size?: number;
}

// Always a rounded-square, contain-fit treatment (never circular, never
// cropped) -- a logo's own composition is part of a business's identity in
// a way a cropped-to-circle photo would distort. Falls back to the
// business name's initials, matching every other identity component in
// this app (UserAvatar, CustomerAvatar) rather than a bare placeholder
// icon, so a business without a logo yet still reads as "this business",
// not "no image is missing."
export function BusinessLogo({ name, logoUrl, size = 44 }: BusinessLogoProps) {
  const { colors, radius, typography } = useTheme();

  // Resets on a genuine URL change so a prior load failure doesn't
  // permanently hide a since-replaced, perfectly loadable logo.
  const [hasImageError, setHasImageError] = useState(false);
  useEffect(() => setHasImageError(false), [logoUrl]);

  if (logoUrl && !hasImageError) {
    return (
      <View
        style={[
          styles.base,
          {
            width: size,
            height: size,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          },
        ]}
      >
        <Image
          source={{ uri: logoUrl }}
          style={{ width: size, height: size }}
          resizeMode="contain"
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
        {
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: colors.softBlue,
        },
      ]}
    >
      <Text style={[typography.caption, { color: colors.softBlueText, fontSize: size * 0.36, lineHeight: size * 0.36 * 1.2 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
