import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';

// No AuthGate, matching app/p/_layout.tsx's and app/c/_layout.tsx's exact
// precedent -- a route group simply never wrapped in AuthGate is what makes
// it anonymous-routable in this app's architecture. This screen never reads
// any authenticated store, so it's anonymous-safe by construction too.
export default function PublicInvoiceLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="[token]" />
    </Stack>
  );
}
