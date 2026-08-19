import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';

export default function RequestsLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
