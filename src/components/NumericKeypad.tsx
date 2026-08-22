import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { KeypadKey } from './KeypadKey';

interface NumericKeypadProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
}

const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'delete'],
];

export function NumericKeypad({ onKeyPress, onDelete }: NumericKeypadProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      {KEY_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { gap: spacing.sm }]}>
          {row.map((key) => (
            <KeypadKey key={key} value={key} onPress={() => (key === 'delete' ? onDelete() : onKeyPress(key))} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
