import { useState } from 'react';
import { View, Text, ScrollView, Switch, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { useSecurityStore } from '../../../src/store/securityStore';
import { isValidPassword } from '../../../src/utils/validators';

export default function SecurityScreen() {
  const { colors, spacing, typography } = useTheme();
  const biometricLockEnabled = useSecurityStore((state) => state.biometricLockEnabled);
  const setBiometricLockEnabled = useSecurityStore((state) => state.setBiometricLockEnabled);
  const appLockEnabled = useSecurityStore((state) => state.appLockEnabled);
  const setAppLockEnabled = useSecurityStore((state) => state.setAppLockEnabled);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  async function handleUpdatePassword() {
    if (currentPassword.trim().length === 0) {
      setError('Enter your current password');
      return;
    }
    if (!isValidPassword(newPassword)) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setError(undefined);
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setIsSaving(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    Alert.alert('Password Updated', 'Your password has been changed.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Security" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          <Text style={[typography.caption, { color: colors.textMuted }]}>CHANGE PASSWORD</Text>
          <TextField label="Current Password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
          <TextField label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry error={error} />
          <TextField label="Confirm New Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          <PrimaryButton label="Update Password" onPress={handleUpdatePassword} loading={isSaving} />

          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.lg }]}>APP SECURITY</Text>
          <ThemeAwareCard style={{ paddingVertical: 0 }}>
            <View style={[styles.row, { paddingVertical: spacing.md }]}>
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>Biometric Lock</Text>
              <Switch
                value={biometricLockEnabled}
                onValueChange={setBiometricLockEnabled}
                trackColor={{ true: colors.primaryAction, false: colors.border }}
                thumbColor={colors.surface}
                accessibilityLabel="Biometric Lock"
              />
            </View>
            <View style={[styles.row, { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>App Lock</Text>
              <Switch
                value={appLockEnabled}
                onValueChange={setAppLockEnabled}
                trackColor={{ true: colors.primaryAction, false: colors.border }}
                thumbColor={colors.surface}
                accessibilityLabel="App Lock"
              />
            </View>
          </ThemeAwareCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
