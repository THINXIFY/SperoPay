import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Linking, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PasswordField } from '../../src/components/PasswordField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { TextButton } from '../../src/components/TextButton';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validators';

const RESEND_COOLDOWN_SECONDS = 30;

export default function SignUpScreen() {
  const { colors, spacing, radius, typography } = useTheme();
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

  function handleFullNameBlur() {
    setErrors((prev) => ({ ...prev, fullName: fullName.trim().length === 0 ? 'Enter your full name' : undefined }));
  }

  function handleEmailBlur() {
    setErrors((prev) => ({ ...prev, email: isValidEmail(email) ? undefined : 'Enter a valid email address' }));
  }

  function handlePasswordBlur() {
    setErrors((prev) => ({ ...prev, password: isValidPassword(password) ? undefined : 'Use at least 8 characters' }));
  }

  async function handleSubmit() {
    const nextErrors: typeof errors = {
      fullName: fullName.trim().length === 0 ? 'Enter your full name' : undefined,
      email: isValidEmail(email) ? undefined : 'Enter a valid email address',
      password: isValidPassword(password) ? undefined : 'Use at least 8 characters',
    };
    setErrors(nextErrors);
    if (nextErrors.fullName || nextErrors.email || nextErrors.password || isLoading) return;

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
      cooldown > 0 ? `Resend in ${cooldown}s` : resendState === 'sending' ? 'Sending...' : 'Resend Email';

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <AppHeader title="Create Account" onBackPress={() => router.back()} />
        <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <View
            style={[
              styles.mailIconCircle,
              { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.softBlue, alignSelf: 'center' },
            ]}
          >
            <Ionicons name="mail-outline" size={28} color={colors.softBlueText} />
          </View>
          <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }]}>
            Check your email
          </Text>
          <Text
            style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}
          >
            We sent a verification link to{' '}
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{email.trim()}</Text>
          </Text>
          {resendState === 'sent' && cooldown > 0 ? (
            <Text
              style={[typography.bodySmall, { color: colors.success, marginTop: spacing.md, textAlign: 'center' }]}
              accessibilityLiveRegion="polite"
            >
              Verification email sent. Check your inbox for a new link.
            </Text>
          ) : null}
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <PrimaryButton label="Open Email App" onPress={handleOpenEmailApp} />
            <SecondaryButton
              label={resendLabel}
              onPress={handleResend}
              disabled={cooldown > 0 || resendState === 'sending'}
            />
          </View>
          <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
            <TextButton label="Use another email" onPress={() => setNeedsConfirmation(false)} />
            <TextButton label="Back to Sign In" onPress={() => router.replace('/(auth)/login')} />
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
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Create your account</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }]}>
            Just the basics for now — the rest comes during setup.
          </Text>
          {authError ? (
            <Text
              style={[typography.bodySmall, { color: colors.error, marginBottom: spacing.base }]}
              accessibilityLiveRegion="polite"
            >
              {authError}
            </Text>
          ) : null}
          <TextField
            label="Full Name"
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
            }}
            onBlur={handleFullNameBlur}
            error={errors.fullName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />
          <TextField
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            onBlur={handleEmailBlur}
            error={errors.email}
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
            showStrength
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
          <PrimaryButton label="Create Account" onPress={handleSubmit} loading={isLoading} />
          <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={8} style={{ marginTop: spacing.md, alignSelf: 'center' }}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              Already have an account? <Text style={{ color: colors.textPrimary }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mailIconCircle: { alignItems: 'center', justifyContent: 'center' },
});
