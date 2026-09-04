import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PasswordField } from '../../src/components/PasswordField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validators';

const RESEND_COOLDOWN_SECONDS = 30;

export default function LoginScreen() {
  const { colors, spacing, typography } = useTheme();
  const signIn = useAuthStore((state) => state.signIn);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const isEmailNotConfirmed = useAuthStore((state) => state.isEmailNotConfirmed);
  const clearError = useAuthStore((state) => state.clearError);
  const resendConfirmationEmail = useAuthStore((state) => state.resendConfirmationEmail);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clears any error left over from another auth screen (e.g. Sign Up, or a
  // swallowed Forgot Password failure) so it never renders here unearned.
  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  async function handleResend() {
    if (resendState === 'sending' || cooldown > 0 || !isValidEmail(email)) return;
    setResendState('sending');
    try {
      await resendConfirmationEmail(email.trim());
      setResendState('sent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      cooldownTimer.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownTimer.current) clearInterval(cooldownTimer.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setResendState('idle');
    }
  }

  // Validates as the user leaves a field, not just on submit -- an obvious
  // "enter a valid email" shouldn't wait for a full form submission to
  // surface. Never re-validates a field that's already showing an error
  // while they're still typing a correction into it (see onChangeText
  // below) -- only a fresh blur re-checks it.
  function handleEmailBlur() {
    setErrors((prev) => ({ ...prev, email: isValidEmail(email) ? undefined : 'Enter a valid email address' }));
  }

  function handlePasswordBlur() {
    setErrors((prev) => ({ ...prev, password: isValidPassword(password) ? undefined : 'Use at least 8 characters' }));
  }

  async function handleSubmit() {
    const nextErrors: typeof errors = {
      email: isValidEmail(email) ? undefined : 'Enter a valid email address',
      password: isValidPassword(password) ? undefined : 'Use at least 8 characters',
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password || isLoading) return;

    try {
      await signIn(email.trim(), password);
      // No explicit navigation here: `hasCompletedOnboarding` for the just-
      // authenticated user can't be read correctly from this closure (it was
      // captured while `user` was still null, before signIn() resolved).
      // AuthGate (wrapping this whole (auth) group in require-guest mode)
      // re-renders reactively once isAuthenticated flips true and redirects
      // using a fresh, correct value — see src/components/AuthGate.tsx.
    } catch {
      // authStore.error already holds a user-friendly message, rendered below.
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Sign In" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Welcome back</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }]}>
            Sign in to continue to Spero.
          </Text>
          {authError && isEmailNotConfirmed ? (
            <View style={{ marginBottom: spacing.base }}>
              <Text
                style={[typography.bodySmall, { color: colors.error }]}
                accessibilityLiveRegion="polite"
              >
                {authError}
              </Text>
              {resendState === 'sent' && cooldown > 0 ? (
                <Text style={[typography.bodySmall, { color: colors.success, marginTop: spacing.xs }]}>
                  Confirmation email sent. Check your inbox.
                </Text>
              ) : (
                <View style={{ marginTop: spacing.sm }}>
                  <SecondaryButton
                    label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend confirmation email'}
                    onPress={handleResend}
                    loading={resendState === 'sending'}
                    disabled={cooldown > 0 || !isValidEmail(email)}
                  />
                </View>
              )}
            </View>
          ) : authError ? (
            <Text
              style={[typography.bodySmall, { color: colors.error, marginBottom: spacing.base }]}
              accessibilityLiveRegion="polite"
            >
              {authError}
            </Text>
          ) : null}
          <TextField
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            onBlur={handleEmailBlur}
            error={errors.email}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <PasswordField
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            onBlur={handlePasswordBlur}
            error={errors.password}
            placeholder="Enter your password"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <Pressable onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Forgot password?</Text>
          </Pressable>
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
          <PrimaryButton label="Sign In" onPress={handleSubmit} loading={isLoading} />
          <Pressable onPress={() => router.push('/(auth)/sign-up')} hitSlop={8} style={{ marginTop: spacing.md, alignSelf: 'center' }}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              Don&apos;t have an account? <Text style={{ color: colors.textPrimary }}>Create Account</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
