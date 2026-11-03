import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { colors, size } from '@/theme';

// Quiet line chart: values left to right, the latest as a red dot. No axes; the caption
// under it says what changed. A single value shows just the dot.
const DOT = size.trendDot / 2; // radius
const STROKE = size.iconStroke;

export function TrendChart({ values }: { values: number[] }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const height = size.chartTrend;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) =>
    values.length === 1 ? DOT : DOT + (i / (values.length - 1)) * (width - DOT * 2);
  // Flat lines sit in the middle; otherwise use the height, leaving room for the dot.
  const y = (v: number) =>
    max === min ? height / 2 : DOT + (1 - (v - min) / span) * (height - DOT * 2);
  const last = values.length - 1;

  return (
    <View onLayout={onLayout} style={styles.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {width > 0 && values.length > 0 && (
        <Svg width={width} height={height}>
          {values.length > 1 && (
            <Polyline
              points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={colors.inkMuted}
              strokeWidth={STROKE}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          <Circle cx={x(last)} cy={y(values[last])} r={DOT} fill={colors.spotterRed} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: size.chartTrend,
    borderBottomWidth: size.divider,
    borderBottomColor: colors.hairline,
  },
});
