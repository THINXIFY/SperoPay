import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';

// No AuthGate, matching app/pay/_layout.tsx's existing (correct, per the
// design doc's audit) precedent — a route group simply never wrapped in
// AuthGate is what makes it anonymous-routable in this app's architecture.
// This route group's screen additionally never reads any authenticated
// store, so it's anonymous-safe by construction, not just by omission.
export default function PublicCheckoutLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="[token]" />
    </Stack>
  );
}
