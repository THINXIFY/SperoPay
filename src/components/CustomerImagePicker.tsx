import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { CustomerAvatar } from './CustomerAvatar';
import type { Customer, CustomerImageType } from '../types';

interface CustomerImagePickerProps {
  name: string;
  avatarColor: Customer['avatarColor'];
  imageUri?: string;
  hasImage: boolean;
  imageType: CustomerImageType;
  onImageTypeChange: (type: CustomerImageType) => void;
  onPress: () => void;
}

// A compact image area for the Add/Edit Customer sheets: a tappable
// avatar/logo preview, a text action beneath it, and -- only once an image
// is actually staged -- a small Photo/Logo choice so the user (not a
// guess) decides which treatment fits their customer. Not force-required;
// a customer with no image just keeps using the initials fallback exactly
// as today.
export function CustomerImagePicker({
  name,
  avatarColor,
  imageUri,
  hasImage,
  imageType,
  onImageTypeChange,
  onPress,
}: CustomerImagePickerProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={hasImage ? 'Change photo or logo' : 'Add photo or logo'}
      >
        <CustomerAvatar name={name || 'Customer'} color={avatarColor} avatarUrl={imageUri} imageType={imageType} size={72} />
      </Pressable>
      <Pressable onPress={onPress} hitSlop={8} style={{ marginTop: spacing.sm }} accessibilityRole="button">
        <Text style={[typography.bodySmall, { color: colors.primaryAction }]}>
          {hasImage ? 'Change' : 'Add photo or logo'}
        </Text>
      </Pressable>

      {hasImage ? (
        <View style={[styles.pillRow, { marginTop: spacing.md, gap: spacing.sm }]}>
          {(['photo', 'logo'] as const).map((type) => {
            const isActive = imageType === type;
            return (
              <Pressable
                key={type}
                onPress={() => onImageTypeChange(type)}
                accessibilityRole="button"
                accessibilityLabel={`Treat image as ${type}`}
                accessibilityState={{ selected: isActive }}
                style={({ pressed }) => [
                  styles.pill,
                  {
                    backgroundColor: isActive ? colors.heroSurface : colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.md,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[typography.caption, { color: isActive ? colors.heroSurfaceText : colors.textSecondary }]}>
                  {type === 'photo' ? 'Photo' : 'Logo'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pillRow: { flexDirection: 'row' },
  pill: { paddingVertical: 6, borderWidth: 1 },
});
