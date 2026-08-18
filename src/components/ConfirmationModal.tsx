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
}

export function ConfirmationModal({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.backdrop, { padding: spacing.xl }]}>
        <View
          style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl }]}
        >
          <Text style={[typography.h3, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            {description}
          </Text>
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <PrimaryButton label={confirmLabel} onPress={onConfirm} />
            <SecondaryButton label={cancelLabel} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,5,5,0.5)', alignItems: 'stretch', justifyContent: 'center' },
});
