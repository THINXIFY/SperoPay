import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Shows a busy state on the confirm button and disables both buttons while a confirm action is in flight -- prevents a double-tap from firing a destructive action twice. */
  loading?: boolean;
}

export function ConfirmationModal({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading,
}: ConfirmationModalProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onCancel}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay, padding: spacing.xl }]}>
        <View
          style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl }]}
        >
          <Text style={[typography.h3, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            {description}
          </Text>
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <PrimaryButton label={confirmLabel} onPress={onConfirm} loading={loading} />
            <SecondaryButton label={cancelLabel} onPress={onCancel} disabled={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'stretch', justifyContent: 'center' },
});
