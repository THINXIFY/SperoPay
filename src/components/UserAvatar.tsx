import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/useTheme';
import { AVATAR_GRADIENT_PRESETS } from '../theme/avatarGradients';
import { getInitials } from '../utils/getInitials';
import type { AvatarBorderStyle } from '../types';

interface UserAvatarProps {
  name: string;
  avatarUri?: string;
  borderStyle?: AvatarBorderStyle;
  size?: number;
}

export function UserAvatar({ name, avatarUri, borderStyle = 'none', size = 44 }: UserAvatarProps) {
  const { colors, typography } = useTheme();

  // Resets on a genuine image change so a prior load failure doesn't
  // permanently hide a since-replaced, perfectly loadable photo.
  const [hasImageError, setHasImageError] = useState(false);
  useEffect(() => setHasImageError(false), [avatarUri]);

  const hasRing = borderStyle !== 'none';
  // Thin by design (spec: ~2-4px depending on size), and it scales with
  // size so a large profile-screen avatar and a small header avatar both
  // read as the same restrained ring, not a thicker band on the bigger one.
  const ringWidth = hasRing ? Math.max(2, Math.round(size * 0.045)) : 0;
  const innerSize = size - ringWidth * 2;

  const content =
    avatarUri && !hasImageError ? (
      <Image
        source={{ uri: avatarUri }}
        style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
        resizeMode="cover"
        onError={() => setHasImageError(true)}
        accessibilityIgnoresInvertColors
      />
    ) : (
      <View
        style={[
          styles.fallback,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: colors.softLavender,
            // A hairline border regardless of what this sits on -- in dark
            // mode, softLavender's own dark variant (#211D3A) sits at
            // roughly the same luminance as heroSurface (#191919, used by
            // e.g. Profile's identity card), so without a defined edge the
            // fallback circle nearly disappears into a dark hero card, not
            // just theoretically but measured (~1.09:1 contrast). Harmless
            // on a light/surface background -- colors.border is a subtle
            // token everywhere else in the app too.
            borderWidth: 1,
            borderColor: colors.border,
          },
        ]}
      >
        <Text
          style={[
            typography.caption,
            { color: colors.softLavenderText, fontSize: innerSize * 0.36, lineHeight: innerSize * 0.36 * 1.2 },
          ]}
        >
          {getInitials(name)}
        </Text>
      </View>
    );

  if (!hasRing) {
    return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>{content}</View>;
  }

  return (
    <LinearGradient
      colors={AVATAR_GRADIENT_PRESETS[borderStyle]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <View style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2, overflow: 'hidden' }}>
        {content}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center' },
});
