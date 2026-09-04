import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { SelectableCard } from '../../src/components/SelectableCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useProfileStore } from '../../src/store/profileStore';
import { useAuthStore } from '../../src/store/authStore';
import type { UsageType } from '../../src/types';

const OPTIONS: { value: UsageType; label: string; icon: 'briefcase-outline' | 'business-outline' | 'color-palette-outline' | 'person-outline' }[] = [
  { value: 'freelancer', label: 'Freelancer', icon: 'briefcase-outline' },
  { value: 'business', label: 'Business', icon: 'business-outline' },
  { value: 'creator', label: 'Creator', icon: 'color-palette-outline' },
  { value: 'personal', label: 'Personal', icon: 'person-outline' },
];

export default function UsageTypeScreen() {
  const { colors, spacing, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const setUsageType = useProfileStore((state) => state.setUsageType);
  const userId = useAuthStore((state) => state.user?.id);
  // A user who stopped onboarding partway through and is resuming should
  // see their prior choice already selected, not a blank grid forcing them
  // to redo a decision they already made.
  const [selected, setSelected] = useState<UsageType | null>(profile?.usageType ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleContinue() {
    if (!selected || !userId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await setUsageType(userId, selected);
      router.push('/(onboarding)/profile');
    } catch {
      Alert.alert('Something went wrong', "We couldn't save that. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl }}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>How will you use Spero?</Text>
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
        <PrimaryButton label="Continue" onPress={handleContinue} disabled={!selected} loading={isSubmitting} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
