import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { easeOut } from '@/lib/motion';
import { colors, motion, radius, size, space, type } from '@/theme';

type Props = { label: string; selected: boolean; onPress: () => void; raised?: boolean };

// Filter chip. Selected is ink-on-white rather than red: red stays for actions.
// `raised` when it sits on a card. Choosing one fades the white in rather than
// snapping, with a small tap under the thumb.
export function Chip({ label, selected, onPress, raised }: Props) {
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const to = selected ? 1 : 0;
    on.value = reduceMotion ? to : withTiming(to, { duration: motion.selectMs, easing: easeOut });
  }, [selected, on, reduceMotion]);

  const fill = useAnimatedStyle(() => ({ opacity: on.value }));
  const text = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [colors.inkMuted, colors.ground]),
  }));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      haptic={selected ? null : 'select'}
      hitSlop={SLOP}
      style={[styles.chip, raised && styles.chipRaised]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fill, fill]} />
      <Animated.Text style={[styles.label, text]}>{label}</Animated.Text>
    </PressableScale>
  );
}

// Brings the 36px chip's touch area up to 44.
const SLOP = { top: (size.tapTarget - size.chip) / 2, bottom: (size.tapTarget - size.chip) / 2 };

const styles = StyleSheet.create({
  chip: {
    minHeight: size.chip,
    paddingHorizontal: space[3],
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipRaised: { backgroundColor: colors.surfaceRaised },
  fill: { backgroundColor: colors.ink },
  label: { ...type.captionStrong, color: colors.inkMuted },
});
