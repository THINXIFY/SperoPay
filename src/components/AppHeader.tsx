import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { IconButton } from './IconButton';

interface AppHeaderProps {
  title: string;
  onBackPress?: () => void;
  rightIcon?: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  onRightPress?: () => void;
}

export function AppHeader({ title, onBackPress, rightIcon, onRightPress }: AppHeaderProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.row, { paddingHorizontal: spacing.base, paddingVertical: spacing.md }]}>
      <View style={styles.side}>
        {onBackPress ? (
          <IconButton name="chevron-back" onPress={onBackPress} accessibilityLabel="Go back" />
        ) : null}
      </View>
      <Text style={[typography.h3, { color: colors.textPrimary }]}>{title}</Text>
      <View style={[styles.side, styles.sideRight]}>
        {rightIcon && onRightPress ? (
          <IconButton name={rightIcon} onPress={onRightPress} accessibilityLabel={`${title} action`} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 40, alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
});
