import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';

export default function ReportsLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="revenue" />
      <Stack.Screen name="outstanding" />
      <Stack.Screen name="customers" />
      <Stack.Screen name="requests" />
      <Stack.Screen name="transactions" />
    </Stack>
  );
}
