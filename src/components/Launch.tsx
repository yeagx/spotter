import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Logo } from '@/components/Logo';
import { easeOut } from '@/lib/motion';
import { colors, motion, size } from '@/theme';

// Android's blurRadius runs stronger than CSS blur; this reads like the mockup's 10px.
const LAUNCH_BLUR = 6;

// App launch: the logo comes into focus (~0.7s), holds until the app knows where to go
// (Today or Onboarding), then steps back and fades to reveal it. Sits over the screens;
// the native splash before it is plain ground so the logo's entrance is this one.
export function Launch({ ready }: { ready: boolean }) {
  const reduceMotion = useReducedMotion();
  const [gone, setGone] = useState(false);
  const focus = useSharedValue(0); // 0 blurred and faint, 1 sharp
  const exit = useSharedValue(0); // 0 shown, 1 gone
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync();
    if (reduceMotion) {
      focus.value = 1;
      setFocused(true);
      return;
    }
    focus.value = withTiming(1, { duration: motion.launchInMs, easing: easeOut }, (finished) => {
      if (finished) scheduleOnRN(setFocused, true);
    });
  }, [focus, reduceMotion]);

  useEffect(() => {
    if (!ready || !focused) return;
    if (reduceMotion) {
      setGone(true);
      return;
    }
    exit.value = withDelay(
      motion.launchHoldMs,
      withTiming(1, { duration: motion.launchOutMs, easing: easeOut }, (finished) => {
        if (finished) scheduleOnRN(setGone, true);
      }),
    );
  }, [ready, focused, exit, reduceMotion]);

  const overlay = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const mark = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scale: (1.06 - 0.06 * focus.value) * (1 - 0.08 * exit.value) }],
  }));
  const blurred = useAnimatedStyle(() => ({ opacity: 1 - focus.value }));

  if (gone) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, overlay]} pointerEvents="auto">
      <Animated.View style={mark}>
        <Logo height={size.logoL} />
        <Animated.View style={[StyleSheet.absoluteFill, blurred]}>
          <View style={styles.blurBack}>
            <Logo height={size.logoL} blurRadius={LAUNCH_BLUR} />
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center' },
  // Hides the sharp mark underneath while the blurred copy is showing.
  blurBack: { backgroundColor: colors.ground },
});
