import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';

export default function RequestLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="amount" />
      <Stack.Screen name="details" />
      <Stack.Screen name="created" />
      <Stack.Screen name="invoice" />
    </Stack>
  );
}
