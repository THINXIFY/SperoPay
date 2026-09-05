import React from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
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
  /** Defaults to a trash icon (the common case: every current call site is
   * either a delete or an equally-irreversible cancel) -- override for a
   * confirmation that isn't literally about deleting something. */
  icon?: keyof typeof Ionicons.glyphMap;
}

// White text on colors.error (#EF4444) is only ~3.8:1 contrast -- fails
// WCAG AA's 4.5:1 for normal-weight 16px text. This is a dedicated, darker
// shade for a SOLID red button fill specifically (white-on-#DC2626 is
// ~4.8:1, passing) -- colors.error itself stays untouched since it's
// already correctly used elsewhere as text/icon color against light
// surfaces, a completely different contrast pairing. Same value in both
// themes, matching colors.error's own theme-invariance.
const DESTRUCTIVE_BUTTON_BACKGROUND = '#DC2626';

// Every current call site of this modal (Delete Template, Cancel Request,
// Delete Request) confirms an irreversible action, so the confirm button
// reads as destructive (a solid error-red, not the app's lime primary --
// lime on a "this can't be undone" action reads as an ordinary, low-stakes
// confirm, not a warning) by default, with a soft-red icon above the title
// making that unmistakable at a glance without being a harsh, jarring wall
// of red.
export function ConfirmationModal({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading,
  icon = 'trash-outline',
}: ConfirmationModalProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onCancel}>
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
          <View style={{ marginTop: spacing.xl, gap: spacing.sm, alignSelf: 'stretch' }}>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ disabled: loading, busy: loading }}
              style={({ pressed }) => [
                styles.confirmButton,
                {
                  backgroundColor: DESTRUCTIVE_BUTTON_BACKGROUND,
                  borderRadius: radius.md,
                  paddingVertical: spacing.base,
                  opacity: loading ? 0.7 : pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[typography.button, { color: '#FFFFFF' }]}>{confirmLabel}</Text>
              )}
            </Pressable>
            <SecondaryButton label={cancelLabel} onPress={onCancel} disabled={loading} />
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
  confirmButton: { alignItems: 'center', justifyContent: 'center' },
});
