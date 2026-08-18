import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { SelectableCard } from '../../src/components/SelectableCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useProfileStore } from '../../src/store/profileStore';
import type { UsageType } from '../../src/types';

const OPTIONS: { value: UsageType; label: string; icon: 'briefcase-outline' | 'business-outline' | 'color-palette-outline' | 'person-outline' }[] = [
  { value: 'freelancer', label: 'Freelancer', icon: 'briefcase-outline' },
  { value: 'business', label: 'Business', icon: 'business-outline' },
  { value: 'creator', label: 'Creator', icon: 'color-palette-outline' },
  { value: 'personal', label: 'Personal', icon: 'person-outline' },
];

export default function UsageTypeScreen() {
  const { colors, spacing, typography } = useTheme();
  const setUsageType = useProfileStore((state) => state.setUsageType);
  const [selected, setSelected] = useState<UsageType | null>(null);

  function handleContinue() {
    if (!selected) return;
    setUsageType(selected);
    router.push('/(onboarding)/profile');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl }}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>How will you use ThinxPay?</Text>
        <View style={[styles.grid, { marginTop: spacing.xl, gap: spacing.md }]}>
          {OPTIONS.map((option) => (
            <View key={option.value} style={{ width: '47%' }}>
              <SelectableCard
                icon={option.icon}
                label={option.label}
                selected={selected === option.value}
                onPress={() => setSelected(option.value)}
              />
            </View>
          ))}
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Continue" onPress={handleContinue} disabled={!selected} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
