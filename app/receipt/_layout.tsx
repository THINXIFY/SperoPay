import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';

// No AuthGate -- same established precedent as app/p/_layout.tsx and
// app/c/_layout.tsx. Anonymous-safe by construction: this screen never
// reads any authenticated store.
export default function PublicReceiptLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="[token]" />
    </Stack>
  );
}
