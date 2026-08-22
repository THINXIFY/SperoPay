import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validators';

const RESEND_COOLDOWN_SECONDS = 30;

export default function SignUpScreen() {
  const { colors, spacing, typography } = useTheme();
  const signUp = useAuthStore((state) => state.signUp);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const resendConfirmationEmail = useAuthStore((state) => state.resendConfirmationEmail);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clears any error left over from another auth screen (e.g. Sign In) so it
  // never renders here unearned.
  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

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
      }
      // No explicit navigation on the non-confirmation path: AuthGate
      // (wrapping this whole (auth) group in require-guest mode) reactively
      // redirects once isAuthenticated flips true, reading fresh state on
      // its own render rather than a value closed over before this await —
      // see the equivalent fix in login.tsx for why that distinction matters.
    } catch {
      // authStore.error already holds a user-friendly message, rendered below.
    }
  }

  async function handleResend() {
    if (resendState === 'sending' || cooldown > 0) return;
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

  function handleOpenEmailApp() {
    // Best-effort only — there's no reliable, config-free cross-platform API
    // for "open the mail app's inbox" in this Expo Go / no-custom-native-
    // module setup. Silently no-ops if it doesn't work on this device.
    Linking.openURL('message://').catch(() => {});
  }

  if (needsConfirmation) {
    const resendLabel =
      cooldown > 0
        ? `Resend available in ${cooldown}s`
        : resendState === 'sending'
          ? 'Sending...'
          : 'Resend Confirmation';

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <AppHeader title="Create Account" onBackPress={() => router.back()} />
        <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center' }]}>Check your email</Text>
          <Text
            style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}
          >
            We sent a confirmation link to:
          </Text>
          <Text
            style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs, textAlign: 'center' }]}
          >
            {email.trim()}
          </Text>
          <Text
            style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}
          >
            Confirm your email to finish setting up your Spero account.
          </Text>
          {resendState === 'sent' && cooldown > 0 ? (
            <Text
              style={[typography.bodySmall, { color: colors.success, marginTop: spacing.md, textAlign: 'center' }]}
            >
              Confirmation email sent. Check your inbox for a new link.
            </Text>
          ) : null}
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <PrimaryButton label="Open Email App" onPress={handleOpenEmailApp} />
            <SecondaryButton
              label={resendLabel}
              onPress={handleResend}
              disabled={cooldown > 0 || resendState === 'sending'}
            />
            <SecondaryButton label="Back to Sign In" onPress={() => router.replace('/(auth)/login')} />
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
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
          <PrimaryButton label="Create Account" onPress={handleSubmit} loading={isLoading} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
