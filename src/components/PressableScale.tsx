import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { haptic as haptics, type HapticKind } from '@/lib/haptics';
import { easeOut } from '@/lib/motion';
import { motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  // A tap under the thumb when the press lands (see lib/haptics for which to use).
  // It fires on the press itself, not on touch-down, so scrolling past a button is silent.
  haptic?: HapticKind | null;
};

// The mockups' sp-press: a slight, slow sink while the finger is down.
export function PressableScale({ style, onPressIn, onPressOut, onPress, haptic, ...props }: Props) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const to = (value: number) => {
    if (!reduceMotion) scale.value = withTiming(value, { duration: motion.pressMs, easing: easeOut });
  };

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        to(motion.pressScale);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
      onPress={
        onPress &&
        ((e) => {
          if (haptic) haptics[haptic]();
          onPress(e);
        })
      }
      style={[style, animated]}
    />
  );
}
