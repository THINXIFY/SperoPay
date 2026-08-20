import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AuthGate } from '../../src/components/AuthGate';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <AuthGate mode="require-guest">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </AuthGate>
  );
}
