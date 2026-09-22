import React, { useMemo, useState } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import type { RevenueTrendPoint } from '../utils/analytics';

interface MiniRevenueSparklineProps {
  points: RevenueTrendPoint[];
  height?: number;
}

// A deliberately quiet, non-interactive sibling of RevenueTrendChart --
// same lime line/gradient DNA (so Home's hero and the full Analytics chart
// read as the same visual language), but built for a small dark hero
// surface specifically: no Pressable/tap-to-select (the whole hero card is
// already one tap target to Analytics -- a second, nested tap target here
// would just be confusing), no tooltip/axis labels (there's no room for
// them at this size, and the exact number is already the big heroNumber
// above it), and every color is the heroSurface-safe pair
// (heroSurfaceText/heroSurfaceTextMuted are never used here since even the
// muted line-fill only needs primaryAction's own opacity, not text color).
export function MiniRevenueSparkline({ points, height = 32 }: MiniRevenueSparklineProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const chart = useMemo(() => {
    if (width === 0 || points.length === 0) return null;
    const maxValue = Math.max(...points.map((p) => p.value), 1);
    const stepX = points.length > 1 ? width / (points.length - 1) : 0;
    const coords = points.map((p, i) => ({
      x: points.length > 1 ? i * stepX : width / 2,
      y: height - (p.value / maxValue) * height,
    }));
    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const areaPath =
      coords.length > 0
        ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`
        : '';
    return { coords, linePath, areaPath };
  }, [points, width, height]);

  const lastCoord = chart?.coords[chart.coords.length - 1];

  return (
    <View onLayout={handleLayout} style={{ height }}>
      {chart ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="miniRevenueSparklineFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primaryAction} stopOpacity={0.35} />
              <Stop offset="1" stopColor={colors.primaryAction} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={chart.areaPath} fill="url(#miniRevenueSparklineFill)" />
          <Path d={chart.linePath} fill="none" stroke={colors.primaryAction} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {lastCoord ? <Circle cx={lastCoord.x} cy={lastCoord.y} r={3} fill={colors.primaryAction} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}
