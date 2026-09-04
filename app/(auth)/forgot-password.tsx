import { useState } from 'react';
import { View, ScrollView, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  const { colors, spacing, radius, typography } = useTheme();
  const sendPasswordReset = useAuthStore((state) => state.sendPasswordReset);
  const isLoading = useAuthStore((state) => state.isLoading);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  function handleEmailBlur() {
    if (sent) return;
    setError(isValidEmail(email) ? undefined : 'Enter a valid email address');
  }

  async function handleSubmit() {
    if (isLoading || sent) return;
    if (!isValidEmail(email)) {
      setError('Enter a valid email address');
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

  if (sent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <AppHeader title="Forgot password?" onBackPress={() => router.back()} />
        <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.full,
              backgroundColor: colors.softBlue,
              alignSelf: 'center',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="mail-outline" size={28} color={colors.softBlueText} />
          </View>
          <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }]}>
            Check your email
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            If an account exists for {email.trim()}, a reset link is on its way.
          </Text>
          <View style={{ marginTop: spacing.xl }}>
            <PrimaryButton label="Back to Sign In" onPress={() => router.replace('/(auth)/login')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Forgot password?" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
            Enter your email and we&apos;ll send you a reset link.
          </Text>
          <TextField
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError(undefined);
            }}
            onBlur={handleEmailBlur}
            error={error}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
          <PrimaryButton label="Send Reset Link" onPress={handleSubmit} loading={isLoading} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
