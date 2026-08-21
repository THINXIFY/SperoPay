import { useState } from 'react';
import { View, ScrollView, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail } from '../../src/utils/validators';

// Sends a real Supabase password-reset email; app/auth/callback.tsx and
// app/(auth)/reset-password.tsx handle the rest of the recovery flow.
export default function ForgotPasswordScreen() {
  const { colors, spacing, typography } = useTheme();
  const sendPasswordReset = useAuthStore((state) => state.sendPasswordReset);
  const isLoading = useAuthStore((state) => state.isLoading);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (isLoading || sent) return;
    if (!isValidEmail(email)) {
      setError('Enter a valid email');
      return;
    }
    setError(undefined);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch {
      // Treat failures the same as success — the existing copy below is already
      // deliberately non-committal about whether an email is registered, and
      // reacting differently to an error here would leak that information.
      // Clear the store's error too: sendPasswordReset sets it internally, and
      // left alone it would resurface on whatever auth screen is mounted
      // behind this one (e.g. Login, reached here via router.push).
      clearError();
      setSent(true);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Reset Password" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!sent}
          />
          {sent ? (
            <Text style={[typography.bodySmall, { color: colors.success, marginTop: spacing.sm }]}>
              If an account exists for that email, a reset link is on its way.
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Send Reset Link" onPress={handleSubmit} loading={isLoading} disabled={sent} />
      </View>
    </SafeAreaView>
  );
}
