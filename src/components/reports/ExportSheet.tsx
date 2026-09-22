import React, { forwardRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { BottomSheetProps } from '@gorhom/bottom-sheet';
import { useTheme } from '../../theme/useTheme';
import { AppBottomSheet } from '../AppBottomSheet';

interface ExportSheetProps extends Partial<Omit<BottomSheetProps, 'children'>> {
  onExportPdf: () => void;
  onExportCsv: () => void;
  // Which export (if any) is currently generating -- disables both rows
  // and shows a spinner on the active one, rather than letting a second
  // tap start a second concurrent export.
  exporting: 'pdf' | 'csv' | null;
  initialIndex?: number;
}

function ExportOption({
  icon,
  title,
  description,
  onPress,
  loading,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      accessibilityState={{ disabled, busy: loading }}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.base,
          marginBottom: spacing.sm,
          opacity: disabled && !loading ? 0.5 : 1,
          backgroundColor: pressed ? colors.background : colors.surface,
        },
      ]}
    >
      <View
        style={[
          styles.iconChip,
          { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryActionSoft, marginRight: spacing.md },
        ]}
      >
        {loading ? <ActivityIndicator size="small" color={colors.primaryAction} /> : <Ionicons name={icon} size={18} color={colors.textPrimary} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export const ExportSheet = forwardRef<BottomSheet, ExportSheetProps>(
  ({ onExportPdf, onExportCsv, exporting, initialIndex = -1, ...rest }, ref) => {
    const { colors, spacing, typography } = useTheme();
    return (
      <AppBottomSheet ref={ref} initialIndex={initialIndex} {...rest}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.lg }]}>Export</Text>

        <ExportOption
          icon="document-text-outline"
          title="PDF Report"
          description="Professional summary for sharing or records."
          onPress={onExportPdf}
          loading={exporting === 'pdf'}
          disabled={exporting !== null}
        />
        <ExportOption
          icon="grid-outline"
          title="CSV Data"
          description="Detailed records for spreadsheets or accounting."
          onPress={onExportCsv}
          loading={exporting === 'csv'}
          disabled={exporting !== null}
        />
      </AppBottomSheet>
    );
  }
);
ExportSheet.displayName = 'ExportSheet';

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  iconChip: { alignItems: 'center', justifyContent: 'center' },
});
