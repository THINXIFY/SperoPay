import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { AVATAR_GRADIENT_PRESETS, AVATAR_BORDER_STYLE_LABELS, AVATAR_BORDER_STYLE_ORDER } from '../theme/avatarGradients';
import type { AvatarBorderStyle } from '../types';

const SWATCH_SIZE = 36;

interface AvatarBorderPickerProps {
  value: AvatarBorderStyle;
  onChange: (value: AvatarBorderStyle) => void;
}

// A restrained, fixed set of presets (spec: 4-6 max) -- swatch size never
// changes on selection (only the outer selection ring's color does), so
// tapping through options never causes the row to reflow.
export function AvatarBorderPicker({ value, onChange }: AvatarBorderPickerProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>Profile Ring</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {AVATAR_BORDER_STYLE_ORDER.map((style) => {
          const isSelected = value === style;
          return (
            <Pressable
              key={style}
              onPress={() => onChange(style)}
              accessibilityRole="button"
              accessibilityLabel={`${AVATAR_BORDER_STYLE_LABELS[style]} profile ring`}
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View
                style={[
                  styles.ringSlot,
                  {
                    width: SWATCH_SIZE,
                    height: SWATCH_SIZE,
                    borderRadius: SWATCH_SIZE / 2,
                    borderWidth: 2,
                    borderColor: isSelected ? colors.primaryAction : 'transparent',
                  },
                ]}
              >
                {style === 'none' ? (
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
                    ]}
                  >
                    <Ionicons name="close" size={14} color={colors.textMuted} />
                  </View>
                ) : (
                  <LinearGradient
                    colors={AVATAR_GRADIENT_PRESETS[style]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.swatch}
                  />
                )}
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                {AVATAR_BORDER_STYLE_LABELS[style]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center' },
  ringSlot: { alignItems: 'center', justifyContent: 'center', padding: 2 },
  swatch: { flex: 1, alignSelf: 'stretch', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
