import React, { useCallback } from 'react';
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

  // One stable callback shared by all 12 keys -- a fresh closure per key
  // (as a per-row `() => ...` would be) hands React.memo on KeypadKey a
  // "changed" prop every render, defeating it.
  const handleKeyPress = useCallback(
    (key: string) => (key === 'delete' ? onDelete() : onKeyPress(key)),
    [onKeyPress, onDelete]
  );

  return (
    <View style={{ gap: spacing.sm }}>
      {KEY_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { gap: spacing.sm }]}>
          {row.map((key) => (
            <KeypadKey key={key} value={key} onPress={handleKeyPress} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
