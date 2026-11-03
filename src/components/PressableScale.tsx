import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { easeOut } from '@/lib/motion';
import { motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

// The mockups' sp-press: a slight, slow sink while the finger is down.
export function PressableScale({ style, onPressIn, onPressOut, ...props }: Props) {
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
      style={[style, animated]}
    />
  );
}
