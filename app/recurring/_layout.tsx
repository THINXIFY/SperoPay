import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';

export default function RecurringLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
    </Stack>
  );
}
