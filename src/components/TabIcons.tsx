import { useEffect, useRef, type ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { easeOut } from '@/lib/motion';
import { motion, size } from '@/theme';

// The tab bar's three icons. Choosing a tab plays that icon's one small move: slow,
// ease-out, never bouncy, like the rest of the app.
//   Today: the outer plates slide onto the bar (loading the dumbbell).
//   Plan:  the binder pins drop in and the header line draws across.
//   Body:  the trend line draws itself, then its arrow.
// The icon at rest is the finished drawing, so with reduce-motion on (or on first
// paint) nothing moves.

type IconProps = { color: ColorValue; focused?: boolean };

const AnimatedPath = Animated.createAnimatedComponent(Path);

const stroke = {
  fill: 'none',
  strokeWidth: size.iconStroke,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

// 0 → 1 each time the tab becomes the chosen one; held at 1 otherwise.
function useChosen(focused: boolean | undefined): SharedValue<number> {
  const progress = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const was = useRef(focused);
  useEffect(() => {
    const became = focused && !was.current;
    was.current = focused;
    if (!became || reduceMotion) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.tabIconMs, easing: easeOut });
  }, [focused, progress, reduceMotion]);
  return progress;
}

// Part of the timeline, as its own 0 → 1: lets one stroke start after another.
const span = (p: number, from: number, to: number) => {
  'worklet';
  return Math.min(1, Math.max(0, (p - from) / (to - from)));
};

// The whole icon settles from a touch smaller as its own move plays.
function Settle({ progress, children }: { progress: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: motion.tabIconScaleFrom + (1 - motion.tabIconScaleFrom) * progress.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function TodayIcon({ color, focused }: IconProps) {
  const p = useChosen(focused);
  // Outer plates start on the inner ones (x 6.5 / 17.5) and slide out to the bar's ends.
  const left = useAnimatedProps(() => {
    const t = span(p.value, 0.15, 1);
    return { d: `M${6.5 - 3 * t} 9v6`, strokeOpacity: t };
  });
  const right = useAnimatedProps(() => {
    const t = span(p.value, 0.15, 1);
    return { d: `M${17.5 + 3 * t} 9v6`, strokeOpacity: t };
  });
  return (
    <Settle progress={p}>
      <Svg width={size.icon} height={size.icon} viewBox="0 0 24 24" {...stroke} stroke={color}>
        <Path d="M6.5 6.5v11" />
        <Path d="M17.5 6.5v11" />
        <AnimatedPath animatedProps={left} d="M3.5 9v6" />
        <AnimatedPath animatedProps={right} d="M20.5 9v6" />
        <Path d="M6.5 12h11" />
      </Svg>
    </Settle>
  );
}

// Length of the header line, so it can be drawn with a dash.
const PLAN_LINE = 16;

export function PlanIcon({ color, focused }: IconProps) {
  const p = useChosen(focused);
  // Pins come down 2 units into their holes, then the header line draws left to right.
  const pins = useAnimatedProps(() => {
    const drop = 2 * (1 - span(p.value, 0, 0.6));
    return { d: `M9 ${3 - drop}v4M15 ${3 - drop}v4` };
  });
  const line = useAnimatedProps(() => ({
    strokeDashoffset: PLAN_LINE * (1 - span(p.value, 0.3, 1)),
  }));
  return (
    <Settle progress={p}>
      <Svg width={size.icon} height={size.icon} viewBox="0 0 24 24" {...stroke} stroke={color}>
        <Rect x="4" y="5" width="16" height="15" rx="2" />
        <AnimatedPath animatedProps={line} d="M4 10h16" strokeDasharray={[PLAN_LINE, PLAN_LINE]} />
        <AnimatedPath animatedProps={pins} d="M9 3v4M15 3v4" />
      </Svg>
    </Settle>
  );
}

// Lengths of the trend line (three segments) and its arrowhead, rounded up.
const TREND = 25;
const ARROW = 10;

export function BodyIcon({ color, focused }: IconProps) {
  const p = useChosen(focused);
  const trend = useAnimatedProps(() => ({ strokeDashoffset: TREND * (1 - span(p.value, 0, 0.75)) }));
  const arrow = useAnimatedProps(() => ({ strokeDashoffset: ARROW * (1 - span(p.value, 0.6, 1)) }));
  return (
    <Settle progress={p}>
      <Svg width={size.icon} height={size.icon} viewBox="0 0 24 24" {...stroke} stroke={color}>
        <AnimatedPath animatedProps={trend} d="M4 18l5-6 4 3 7-9" strokeDasharray={[TREND, TREND]} />
        <AnimatedPath animatedProps={arrow} d="M15 6h5v5" strokeDasharray={[ARROW, ARROW]} />
      </Svg>
    </Settle>
  );
}
