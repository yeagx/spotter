import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { easeOut } from '@/lib/motion';
import { colors, motion, radius, size, space, type } from '@/theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T | null; // null: nothing chosen yet
  onChange: (value: T) => void;
};

const PAD = space[1];
const GAP = space[1];

// A small set of mutually exclusive choices on one track, e.g. "Estimate for me /
// I know my number". The chosen one lifts to surface-raised; no red, it's not an action.
// The lifted pill slides from one choice to the next instead of jumping.
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const count = options.length;
  const index = options.findIndex((o) => o.value === value);
  const item = count > 0 ? (width - PAD * 2 - GAP * (count - 1)) / count : 0;
  const measured = width > 0 && item > 0;

  const x = useSharedValue(0);
  const shown = useSharedValue(0);
  useEffect(() => {
    if (!measured) return;
    const to = Math.max(0, index) * (item + GAP);
    // The first placement, and a choice appearing from nothing, land in place; only a
    // move between two choices slides.
    const slide = !reduceMotion && shown.value === 1 && index >= 0;
    x.value = slide ? withTiming(to, { duration: motion.expandMs, easing: easeOut }) : to;
    shown.value = index >= 0 ? 1 : 0;
  }, [index, item, measured, reduceMotion, x, shown]);

  const pill = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.track} accessibilityRole="radiogroup" onLayout={onLayout}>
      {measured && <Animated.View pointerEvents="none" style={[styles.pill, { width: item }, pill]} />}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            haptic={on ? null : 'select'}
            // Until the track is measured there's no pill to slide, so the item lifts itself.
            style={[styles.item, on && !measured && styles.itemOn]}
          >
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={2}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: GAP,
    padding: PAD,
    borderRadius: radius.sm + space[1],
    backgroundColor: colors.surface,
  },
  pill: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  item: {
    flex: 1,
    minHeight: size.tapTarget,
    paddingHorizontal: space[2],
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemOn: { backgroundColor: colors.surfaceRaised },
  label: { ...type.captionStrong, color: colors.inkMuted, textAlign: 'center' },
  labelOn: { color: colors.ink },
});
