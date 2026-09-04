import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { formatCurrency } from '../utils/formatCurrency';
import type { Customer, ExpiryOption, Template } from '../types';

const EXPIRY_LABELS: Record<ExpiryOption, string> = {
  '1h': '1 hour',
  '24h': '24 hours',
  '7d': '7 days',
  never: 'Never',
};

function footerCaptionFor(template: Template, customer: Customer | undefined): string {
  const expiryPart = template.expiryOption === 'never' ? 'Never expires' : `Expires in ${EXPIRY_LABELS[template.expiryOption]}`;
  return customer ? `${expiryPart} · ${customer.name}` : expiryPart;
}

interface PaymentTemplateCardProps {
  template: Template;
  customer: Customer | undefined;
  disabled?: boolean;
  // Omit to hide the star entirely (the Archived view doesn't offer it --
  // an archived template's relevance ordering doesn't matter anymore).
  onToggleFavorite?: () => void;
  onPress: () => void;
  onOpenActions: () => void;
}

// Shared between the active list (app/(app)/profile/templates/index.tsx)
// and the Archived view (.../templates/archived.tsx) so both present the
// same template identically -- only which actions are wired up differs.
export function PaymentTemplateCard({
  template,
  customer,
  disabled,
  onToggleFavorite,
  onPress,
  onOpenActions,
}: PaymentTemplateCardProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const amountLabel = template.amount != null ? `${formatCurrency(template.amount)} ${template.currency}` : 'Flexible amount';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${template.name}, ${amountLabel}. Use this template`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.base,
          opacity: disabled ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View
          style={[styles.iconChip, { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.softMint }]}
        >
          <Ionicons name="copy-outline" size={15} color={colors.softMintText} />
        </View>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]} numberOfLines={1}>
          {template.name}
        </Text>
        {onToggleFavorite ? (
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={template.isFavorite ? `Remove ${template.name} from favorites` : `Mark ${template.name} as favorite`}
            accessibilityState={{ selected: template.isFavorite }}
          >
            <Ionicons
              name={template.isFavorite ? 'star' : 'star-outline'}
              size={19}
              color={template.isFavorite ? colors.primaryAction : colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>

      {template.description ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]} numberOfLines={1}>
          {template.description}
        </Text>
      ) : null}

      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>{amountLabel}</Text>

      <View
        style={[
          styles.footerRow,
          { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
        ]}
      >
        <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
          {footerCaptionFor(template, customer)}
        </Text>
        <Pressable
          onPress={onOpenActions}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${template.name} options`}
          style={{ marginLeft: spacing.sm }}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconChip: { alignItems: 'center', justifyContent: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
});
