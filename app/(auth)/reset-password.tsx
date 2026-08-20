import { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { useHasCompletedOnboarding } from '../../src/store/onboardingStore';
import { resolveInitialRoute } from '../../src/utils/authRouting';
import { isValidPassword } from '../../src/utils/validators';

export default function ResetPasswordScreen() {
  const { colors, spacing, typography } = useTheme();
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const clearPasswordRecovery = useAuthStore((state) => state.clearPasswordRecovery);
  const signOut = useAuthStore((state) => state.signOut);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const hasCompletedOnboarding = useHasCompletedOnboarding();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  async function handleSubmit() {
    const nextErrors: typeof errors = {};
    if (!isValidPassword(password)) nextErrors.password = 'Use at least 8 characters';
    if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || isLoading) return;

    try {
      await updatePassword(password);
      clearPasswordRecovery();
      setDone(true);
    } catch {
      // authStore.error already holds a user-friendly message, rendered below.
    }
  }

  function handleContinue() {
    router.replace(resolveInitialRoute({ isAuthenticated: true, hasCompletedOnboarding }));
  }

  async function handleCancel() {
    clearPasswordRecovery();
    await signOut().catch(() => {});
    router.replace('/(auth)/welcome');
  }

  if (done) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center' }]}>Password updated</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            Your new password is ready to use.
          </Text>
          <View style={{ marginTop: spacing.xl }}>
            <PrimaryButton label="Continue" onPress={handleContinue} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Reset Password" onBackPress={handleCancel} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.lg }]}>
            Choose a new password
          </Text>
          {authError ? (
            <Text style={[typography.bodySmall, { color: colors.error, marginBottom: spacing.base }]}>
              {authError}
            </Text>
          ) : null}
          <TextField
            label="New Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            returnKeyType="next"
          />
          <TextField
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={errors.confirmPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Update Password" onPress={handleSubmit} loading={isLoading} />
      </View>
    </SafeAreaView>
  );
}
