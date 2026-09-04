import { useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { PrimaryButton } from './PrimaryButton';
import { useProfileStore } from '../store/profileStore';

interface ProfileLoadErrorProps {
  onRetry: () => Promise<void>;
}

// Shown by AuthGate (and the splash screen) in place of a redirect decision
// whenever the authenticated user's profile fetch failed -- a network
// error, a transient RLS/session-propagation hiccup, anything -- rather
// than letting that failure fall through to "onboarding_completed is
// false" and send an already-onboarded user back through setup. See the
// AuthGate.tsx comment for why that distinction matters.
export function ProfileLoadError({ onRetry }: ProfileLoadErrorProps) {
  const { colors, spacing, typography } = useTheme();
  const error = useProfileStore((state) => state.error);
  const [isRetrying, setIsRetrying] = useState(false);

  async function handleRetry() {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
        <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
          We couldn't load your account
        </Text>
        <Text
          style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}
        >
          {error ?? "We couldn't load your profile. Check your connection and try again."}
        </Text>
        <View style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}>
          <PrimaryButton label="Try Again" onPress={handleRetry} loading={isRetrying} />
        </View>
      </View>
    </SafeAreaView>
  );
}
