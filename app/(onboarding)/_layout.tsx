import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AuthGate } from '../../src/components/AuthGate';

export default function OnboardingLayout() {
  const { colors } = useTheme();

  return (
    <AuthGate mode="require-auth">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </AuthGate>
  );
}
