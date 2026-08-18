import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface NumericKeypadProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'];

export function NumericKeypad({ onKeyPress, onDelete }: NumericKeypadProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={styles.grid}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          onPress={() => (key === 'delete' ? onDelete() : onKeyPress(key))}
          style={({ pressed }) => [styles.key, { opacity: pressed ? 0.5 : 1 }]}
        >
          {key === 'delete' ? (
            <Ionicons name="backspace-outline" size={24} color={colors.textPrimary} />
          ) : (
            <Text style={[typography.h1, { color: colors.textPrimary }]}>{key}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  key: { width: '33.33%', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
});
