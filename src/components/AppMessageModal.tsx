import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { PrimaryButton } from './PrimaryButton';

interface AppMessageModalProps {
  visible: boolean;
  title: string;
  description: string;
  actionLabel?: string;
  onDismiss: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

// Spero's themed replacement for a system Alert.alert() when a single
// action failed and needs a friendly explanation -- shares ConfirmationModal's
// card/backdrop/icon-ring visual language, but single-action and non-
// destructive (a normal lime PrimaryButton, not ConfirmationModal's solid-red
// confirm button, since dismissing an error isn't a destructive choice).
export function AppMessageModal({
  visible,
  title,
  description,
  actionLabel = 'OK',
  onDismiss,
  icon = 'alert-circle-outline',
}: AppMessageModalProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay, padding: spacing.xl }]}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl }]}>
          <View
            style={[
              styles.iconRing,
              { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.softRed, marginBottom: spacing.base },
            ]}
          >
            <Ionicons name={icon} size={22} color={colors.error} />
          </View>
          <Text style={[typography.h3, { color: colors.textPrimary, textAlign: 'center' }]}>{title}</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            {description}
          </Text>
          <View style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}>
            <PrimaryButton label={actionLabel} onPress={onDismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'stretch', justifyContent: 'center' },
  card: { alignItems: 'center' },
  iconRing: { alignItems: 'center', justifyContent: 'center' },
});
