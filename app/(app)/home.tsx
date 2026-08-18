import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/useTheme';

export default function HomeScreen() {
  const { colors, typography } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>Home</Text>
      </View>
    </SafeAreaView>
  );
}
