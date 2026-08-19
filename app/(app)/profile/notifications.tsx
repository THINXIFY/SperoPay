import { View, Text, ScrollView, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { useNotificationStore } from '../../../src/store/notificationStore';
import type { NotificationPreferences } from '../../../src/types';

const TOGGLES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'paymentReceived', label: 'Payment Received', description: 'When a customer completes a payment.' },
  { key: 'paymentDetected', label: 'Payment Detected', description: 'When a payment is seen but not yet confirmed.' },
  { key: 'requestExpired', label: 'Request Expired', description: 'When an unpaid request passes its expiry.' },
  { key: 'requestReminder', label: 'Request Reminder', description: 'Reminders you send to customers about pending requests.' },
];

export default function NotificationsScreen() {
  const { colors, spacing, typography } = useTheme();
  const preferences = useNotificationStore((state) => state.preferences);
  const updatePreferences = useNotificationStore((state) => state.updatePreferences);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Notifications" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          {TOGGLES.map((toggle, index) => (
            <View
              key={toggle.key}
              style={[
                styles.row,
                { paddingVertical: spacing.md, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border },
              ]}
            >
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={[typography.body, { color: colors.textPrimary }]}>{toggle.label}</Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                  {toggle.description}
                </Text>
              </View>
              <Switch
                value={preferences[toggle.key]}
                onValueChange={(value) => updatePreferences({ [toggle.key]: value })}
                trackColor={{ true: colors.primaryAction, false: colors.border }}
                thumbColor={colors.surface}
                accessibilityLabel={toggle.label}
              />
            </View>
          ))}
        </ThemeAwareCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
