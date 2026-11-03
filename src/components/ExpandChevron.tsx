import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ChevronDownIcon } from '@/components/Icons';
import { easeOut } from '@/lib/motion';
import { motion } from '@/theme';

// Down chevron that turns over, slowly, when its card opens.
export function ExpandChevron({ open }: { open: boolean }) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(open ? 180 : 0);

  useEffect(() => {
    const to = open ? 180 : 0;
    turn.value = reduceMotion ? to : withTiming(to, { duration: motion.expandMs, easing: easeOut });
  }, [open, reduceMotion, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  return (
    <Animated.View style={style}>
      <ChevronDownIcon />
    </Animated.View>
  );
}
