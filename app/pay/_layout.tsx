import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';

export default function PayLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="demo" />
    </Stack>
  );
}
