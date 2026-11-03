import { Platform } from 'react-native';
import {
  Easing,
  FadeIn,
  FadeInDown,
  Keyframe,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import { motion } from '@/theme';

export const easeOut = Easing.bezier(...motion.easeOut);

// Reanimated on web pins an element `position: absolute` at a layout snapshot once a
// custom Keyframe ends, which scrambles screens whose layout changes afterwards. The
// web preview therefore uses the built-in fades; phones get the exact keyframes.
export const isWeb = Platform.OS === 'web';

export function webSafe<K>(keyframe: K, delay = 0, duration = motion.fadeMs) {
  return isWeb
    ? FadeIn.duration(duration).delay(delay).reduceMotion(ReduceMotion.System)
    : keyframe;
}

// The mockups' sp-rise: fade in while settling up 14px. Pass a delay to stagger a list.
// ReduceMotion.System skips it when the phone's reduce-motion setting is on.
export function rise(delay = 0) {
  if (isWeb) {
    return FadeInDown.duration(motion.riseMs)
      .delay(delay)
      .easing(easeOut)
      .reduceMotion(ReduceMotion.System);
  }
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: motion.riseDistance }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: easeOut },
  })
    .duration(motion.riseMs)
    .delay(delay)
    .reduceMotion(ReduceMotion.System);
}

// Neighbours slide into place when a card opens, closes, or a row is removed.
export const settle = LinearTransition.duration(motion.expandMs)
  .easing(easeOut)
  .reduceMotion(ReduceMotion.System);

export const stagger = (index: number, start = 0) => start + index * motion.staggerMs;
