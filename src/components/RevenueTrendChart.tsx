import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, LayoutChangeEvent, GestureResponderEvent, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { formatCurrency } from '../utils/formatCurrency';
import type { RevenueTrendPoint } from '../utils/analytics';

interface RevenueTrendChartProps {
  points: RevenueTrendPoint[];
  height?: number;
}

// A deliberately minimal line/area chart: no grid lines, no axis, no
// legend, at most 3 x-axis labels (first/middle/last) -- the shape and the
// latest value are the only things a merchant actually needs to read in
// under 5 seconds. Built on react-native-svg (already a dependency, via
// QRCodeCard) rather than pulling in a charting library for what is, at
// this data density, a straight-segment polyline plus a gradient fill.
//
// Tap-to-select: a single tap finds the nearest point and shows its exact
// label/value above the chart plus a highlighted dot and guide line --
// deliberately just a tap, not a drag-to-scrub gesture, per "no
// complicated gestures". Defaults to the latest point when nothing has
// been tapped yet, so the callout is never empty.
export function RevenueTrendChart({ points, height = 160 }: RevenueTrendChartProps) {
  const { colors, spacing, typography } = useTheme();
  const [width, setWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setSelectedIndex(null);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    // Re-fades and clears the selection whenever the caller passes a new
    // `points` array (a period switch), not on every render -- `points` is
    // only ever a fresh array when its underlying data actually changed
    // (see AnalyticsScreen's useMemo), so referential equality is the
    // right trigger here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const chart = useMemo(() => {
    if (width === 0 || points.length === 0) return null;
    const maxValue = Math.max(...points.map((p) => p.value), 1);
    const paddingTop = 12;
    const plotHeight = height - paddingTop;
    const stepX = points.length > 1 ? width / (points.length - 1) : 0;

    const coords = points.map((p, i) => ({
      x: points.length > 1 ? i * stepX : width / 2,
      y: paddingTop + plotHeight - (p.value / maxValue) * plotHeight,
    }));

    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const areaPath =
      coords.length > 0
        ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`
        : '';

    // At most 3 labels (first/middle/last) -- enough to orient the eye
    // without turning the x-axis into a wall of tiny text.
    const labelIndices =
      points.length <= 1 ? [0] : points.length === 2 ? [0, 1] : [0, Math.floor((points.length - 1) / 2), points.length - 1];

    return { coords, linePath, areaPath, stepX, labelIndices };
  }, [points, width, height]);

  function handlePress(event: GestureResponderEvent) {
    if (!chart || points.length === 0) return;
    if (points.length === 1) {
      setSelectedIndex(0);
      return;
    }
    const tapX = event.nativeEvent.locationX;
    const index = Math.round(tapX / chart.stepX);
    setSelectedIndex(Math.max(0, Math.min(points.length - 1, index)));
  }

  const activeIndex = selectedIndex ?? points.length - 1;
  const activePoint = chart?.coords[activeIndex];
  const activeData = points[activeIndex];

  return (
    <View>
      {activeData ? (
        <View style={[styles.tooltipRow, { marginBottom: spacing.sm }]}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{activeData.label}</Text>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
            {formatCurrency(activeData.value)}
          </Text>
        </View>
      ) : null}
      <Pressable
        onLayout={handleLayout}
        onPress={handlePress}
        style={{ height }}
        accessibilityRole="button"
        accessibilityLabel={
          activeData ? `Revenue trend chart. Currently showing ${activeData.label}: ${formatCurrency(activeData.value)}` : 'Revenue trend chart'
        }
        accessibilityHint="Tap a point to see its exact value"
      >
        {chart ? (
          <Animated.View style={{ opacity: fade }}>
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="revenueTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primaryAction} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={colors.primaryAction} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={chart.areaPath} fill="url(#revenueTrendFill)" />
              <Path d={chart.linePath} fill="none" stroke={colors.primaryAction} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {activePoint ? (
                <>
                  {selectedIndex !== null ? (
                    <Line x1={activePoint.x} y1={0} x2={activePoint.x} y2={height} stroke={colors.border} strokeWidth={1} />
                  ) : null}
                  <Circle cx={activePoint.x} cy={activePoint.y} r={selectedIndex !== null ? 5 : 4} fill={colors.primaryAction} />
                </>
              ) : null}
            </Svg>
          </Animated.View>
        ) : null}
      </Pressable>
      {chart ? (
        <View style={[styles.labelRow, { marginTop: spacing.xs }]}>
          {chart.labelIndices.map((i) => (
            <Text key={i} style={[typography.caption, { color: colors.textMuted }]}>
              {points[i].label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tooltipRow: { flexDirection: 'row', alignItems: 'baseline' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
