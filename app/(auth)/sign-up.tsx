import { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validators';

export default function SignUpScreen() {
  const { colors, spacing, typography } = useTheme();
  const signUp = useAuthStore((state) => state.signUp);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  // Clears any error left over from another auth screen (e.g. Sign In) so it
  // never renders here unearned.
  useEffect(() => {
    clearError();
  }, [clearError]);

  async function handleSubmit() {
    const nextErrors: typeof errors = {};
    if (fullName.trim().length === 0) nextErrors.fullName = 'Enter your full name';
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email';
    if (!isValidPassword(password)) nextErrors.password = 'Use at least 8 characters';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || isLoading) return;

    try {
      const { needsEmailConfirmation } = await signUp(fullName.trim(), email.trim(), password);
      if (needsEmailConfirmation) {
        setNeedsConfirmation(true);
      } else {
        router.replace('/(onboarding)/usage-type');
      }
    } catch {
      // authStore.error already holds a user-friendly message, rendered below.
    }
  }

  if (needsConfirmation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <AppHeader title="Create Account" onBackPress={() => router.back()} />
        <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center' }]}>Check your email</Text>
          <Text
            style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}
          >
            We've sent you a confirmation link. Confirm your email, then sign in to continue.
          </Text>
          <View style={{ marginTop: spacing.xl }}>
            <PrimaryButton label="Go to Sign In" onPress={() => router.replace('/(auth)/login')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Create Account" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.lg }]}>
            Create your Spero account
          </Text>
          {authError ? (
            <Text style={[typography.bodySmall, { color: colors.error, marginBottom: spacing.base }]}>
              {authError}
            </Text>
          ) : null}
          <TextField
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            error={errors.fullName}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Create Account" onPress={handleSubmit} loading={isLoading} />
      </View>
    </SafeAreaView>
  );
}
