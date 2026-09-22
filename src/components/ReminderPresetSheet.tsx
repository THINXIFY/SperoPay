import React, { forwardRef } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView, BottomSheetProps } from '@gorhom/bottom-sheet';
import { useTheme } from '../theme/useTheme';
import { REMINDER_PRESETS, reminderScheduleSummary } from '../utils/reminderSchedule';
import type { ReminderPreset } from '../types';

const PRESET_OPTIONS: { value: ReminderPreset; label: string; description: string }[] = [
  { value: 'gentle', label: 'Gentle', description: reminderScheduleSummary(REMINDER_PRESETS.gentle) },
  { value: 'standard', label: 'Standard', description: reminderScheduleSummary(REMINDER_PRESETS.standard) },
  { value: 'frequent', label: 'Frequent', description: reminderScheduleSummary(REMINDER_PRESETS.frequent) },
  { value: 'custom', label: 'Custom', description: 'Choose your own reminder points' },
];

interface ReminderPresetSheetProps extends Partial<Omit<BottomSheetProps, 'children'>> {
  value: ReminderPreset;
  onSelect: (preset: ReminderPreset) => void;
  initialIndex?: number;
}

const SNAP_POINTS = ['55%'];

// Shared between the Payment Template form (a default for requests created
// from it) and a request's own Manage Reminders sheet -- one picker, one
// visual treatment, so "Standard" means the exact same thing and looks the
// same wherever it's chosen.
export const ReminderPresetSheet = forwardRef<BottomSheet, ReminderPresetSheetProps>(
  ({ value, onSelect, initialIndex = -1, ...rest }, ref) => {
    const { colors, spacing, radius, typography } = useTheme();

    return (
      <BottomSheet
        ref={ref}
        snapPoints={SNAP_POINTS}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.xl }}
        handleIndicatorStyle={{ backgroundColor: colors.border, width: 40, height: 4 }}
        {...rest}
        index={initialIndex}
      >
        <BottomSheetView style={{ paddingHorizontal: spacing.base, paddingBottom: spacing.xl }}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
            Reminder schedule
          </Text>
          {PRESET_OPTIONS.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onSelect(option.value)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderRadius: radius.md,
                    padding: spacing.base,
                    backgroundColor: selected ? colors.softMint : pressed ? colors.background : 'transparent',
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                <Text
                  style={{ flex: 1 }}
                >
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{option.label}</Text>
                  {'\n'}
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{option.description}</Text>
                </Text>
                {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.softMintText} /> : null}
              </Pressable>
            );
          })}
        </BottomSheetView>
      </BottomSheet>
    );
  }
);
ReminderPresetSheet.displayName = 'ReminderPresetSheet';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
