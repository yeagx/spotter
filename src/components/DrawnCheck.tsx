import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { easeOut } from '@/lib/motion';
import { colors, motion, size } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Same tick as CheckIcon, but it draws itself in, short stroke then long, the way a
// hand ticks a box. Mount it when something becomes done. With reduce-motion on it's
// simply there.
const PATH = 'M5 12.5l4.5 4.5L19 7.5';
const LENGTH = 20; // a little over the path's 19.8, so the dash covers it fully

type Props = { size?: number; color?: ColorValue; delay?: number };

export function DrawnCheck({ size: s = size.iconXs, color = colors.onRed, delay = 0 }: Props) {
  const reduceMotion = useReducedMotion();
  const drawn = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const t = setTimeout(() => {
      drawn.value = withTiming(1, { duration: motion.tickMs, easing: easeOut });
    }, delay);
    return () => clearTimeout(t);
  }, [drawn, delay, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - drawn.value) }));

  return (
    <Svg width={s} height={s} viewBox="0 0 24 24">
      <AnimatedPath
        d={PATH}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={LENGTH}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
