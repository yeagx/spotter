import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { SlantBar } from '@/components/Slant';
import { getSplit } from '@/db/plan';
import { createSession } from '@/db/sessions';
import { notify } from '@/lib/confirm';
import { easeOut, isWeb, webSafe } from '@/lib/motion';
import { dayTitle } from '@/lib/scheme';
import { WEEK } from '@/lib/week';
import { colors, motion, size, space, type } from '@/theme';

// The logo's three beats, played once as a workout starts: focus (in from blur),
// support (a small give and recover), locked in. Tap anywhere to begin.

// Blur radius of the out-of-focus copy (the mockup's 18px CSS blur, roughly halved
// because Android's blurRadius is stronger).
const FOCUS_BLUR = 9;
const SWEEP_WIDTH = 48;
const SWEEP_HEIGHT = 4;

const focusIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.12 }] },
  45: { opacity: 1, transform: [{ scale: 1 }], easing: easeOut },
  62: { opacity: 1, transform: [{ scale: 0.94 }], easing: easeOut },
  80: { opacity: 1, transform: [{ scale: 1.02 }], easing: easeOut },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: easeOut },
})
  .duration(motion.focusMs)
  .reduceMotion(ReduceMotion.System);

// A blurred copy over the sharp logo fades away during the focus beat.
const unblur = new Keyframe({
  0: { opacity: 1 },
  45: { opacity: 0, easing: easeOut },
  100: { opacity: 0 },
})
  .duration(motion.focusMs)
  .reduceMotion(ReduceMotion.System);

const sweep = new Keyframe({
  0: { transform: [{ scaleX: 0 }] },
  100: { transform: [{ scaleX: 1 }], easing: easeOut },
})
  .delay(motion.sweepDelayMs)
  .duration(motion.sweepMs)
  .reduceMotion(ReduceMotion.System);

const fadeIn = (delay: number) =>
  webSafe(
    new Keyframe({ 0: { opacity: 0 }, 100: { opacity: 1, easing: easeOut } })
      .delay(delay)
      .duration(motion.fadeMs)
      .reduceMotion(ReduceMotion.System),
    delay,
  );

export default function StartScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const db = useSQLiteContext();
  const reduceMotion = useReducedMotion();
  const [line, setLine] = useState('');
  const starting = useRef(false);

  useEffect(() => {
    getSplit(db).then((split) => {
      const training = WEEK.flatMap((w) => split?.days.filter((d) => d.weekday === w) ?? []);
      const i = training.findIndex((d) => d.id === dayId);
      if (i >= 0) setLine(`Day ${i + 1} · ${dayTitle(training[i])}`);
    });
  }, [db, dayId]);

  // "locked in." gathers from wide spacing, the way the letters settle into the mark.
  const lock = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    lock.value = withDelay(motion.lockDelayMs, withTiming(1, { duration: motion.lockMs, easing: easeOut }));
    const tap = setTimeout(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
      motion.lockDelayMs,
    );
    return () => clearTimeout(tap);
  }, [lock, reduceMotion]);

  const lockStyle = useAnimatedStyle(() => ({
    opacity: lock.value,
    letterSpacing: LOCK_SPACING_FROM + (LOCK_SPACING_TO - LOCK_SPACING_FROM) * lock.value,
  }));

  const begin = async () => {
    if (starting.current || !dayId) return;
    starting.current = true;
    try {
      const id = await createSession(db, dayId);
      router.replace({ pathname: '/workout/[id]', params: { id } });
    } catch {
      starting.current = false;
      notify('Couldn’t start', 'Something went wrong starting the session. Try again.');
    }
  };

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Begin session" onPress={begin} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Animated.View entering={webSafe(focusIn, 0, motion.focusMs / 2)} style={styles.logo}>
            <Logo height={size.logoXl} />
            {!isWeb && (
              <Animated.View entering={unblur} style={StyleSheet.absoluteFill}>
                <Logo height={size.logoXl} blurRadius={FOCUS_BLUR} />
              </Animated.View>
            )}
          </Animated.View>
          <View style={styles.words}>
            <Animated.Text style={[styles.lock, lockStyle]}>locked in.</Animated.Text>
            <Animated.View entering={webSafe(sweep, motion.sweepDelayMs)} style={styles.sweep}>
              <SlantBar width={SWEEP_WIDTH} height={SWEEP_HEIGHT} color={colors.spotterRed} />
            </Animated.View>
            <Animated.Text entering={fadeIn(motion.dayLineDelayMs)} style={styles.day}>
              {line}
            </Animated.Text>
          </View>
        </View>
        <Animated.Text entering={fadeIn(motion.beginHintDelayMs)} style={styles.hint}>
          Tap to begin
        </Animated.Text>
      </SafeAreaView>
    </Pressable>
  );
}

// From the mockup: 0.5em to 0.08em on 20px type.
const LOCK_SPACING_FROM = type.numeralS.fontSize * 0.5;
const LOCK_SPACING_TO = type.numeralS.fontSize * 0.08;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  safe: { flex: 1, paddingBottom: space[8] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[8] + space[2] },
  logo: { alignItems: 'center', justifyContent: 'center' },
  words: { alignItems: 'center', gap: space[2] },
  lock: { ...type.numeralS, color: colors.ink },
  sweep: { transformOrigin: 'left' },
  day: { ...type.caption, color: colors.inkMuted, textAlign: 'center' },
  hint: { ...type.labelWide, color: colors.inkMuted, textAlign: 'center' },
});
