import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface SkeletonLoaderProps {
  width: number | `${number}%`;
  height: number;
  style?: ViewStyle;
}

export function SkeletonLoader({ width, height, style }: SkeletonLoaderProps) {
  const { colors, radius } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, backgroundColor: colors.border, borderRadius: radius.sm, opacity },
        style,
      ]}
    />
  );
}
