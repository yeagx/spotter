import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { easeOut } from '@/lib/motion';
import { colors, motion, size } from '@/theme';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Quiet line chart: values left to right, the latest as a red dot. No axes; the caption
// under it says what changed. A single value shows just the dot.
// The line draws itself from the oldest reading to the newest, and the dot arrives as
// the line reaches it. It redraws when the values change (another stat is chosen).
const DOT = size.trendDot / 2; // radius
const STROKE = size.iconStroke;

export function TrendChart({ values, delay = 0 }: { values: number[]; delay?: number }) {
  const reduceMotion = useReducedMotion();
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

  // The line's length on screen, so a dash that long can be slid along it.
  let length = 0;
  for (let i = 1; i < values.length; i++) {
    length += Math.hypot(x(i) - x(i - 1), y(values[i]) - y(values[i - 1]));
  }
  length = Math.ceil(length) + 1;

  const drawn = useSharedValue(reduceMotion ? 1 : 0);
  const signature = values.join(',');
  const ready = width > 0;
  useEffect(() => {
    if (!ready || reduceMotion) return;
    drawn.value = 0;
    drawn.value = withDelay(delay, withTiming(1, { duration: motion.barMs, easing: easeOut }));
  }, [signature, ready, delay, drawn, reduceMotion]);

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.value) }));
  // The dot fades in over the last stretch of the line.
  const dotProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, (drawn.value - 0.6) / 0.4)) }));

  return (
    <View onLayout={onLayout} style={styles.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {ready && values.length > 0 && (
        <Svg width={width} height={height}>
          {values.length > 1 && (
            <AnimatedPolyline
              points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={colors.inkMuted}
              strokeWidth={STROKE}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={length}
              animatedProps={lineProps}
            />
          )}
          <AnimatedCircle
            cx={x(last)}
            cy={y(values[last])}
            r={DOT}
            fill={colors.spotterRed}
            animatedProps={dotProps}
          />
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
