import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { ArrowRightIcon } from '@/components/Icons';
import { PressableScale } from '@/components/PressableScale';
import { SlantBar } from '@/components/Slant';
import { formatClock } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { rise } from '@/lib/motion';
import { useLive, useWorkoutOpen } from '@/state/liveSession';
import { colors, radius, size, space, type } from '@/theme';

// A session left running: its day, the rest countdown (or the session clock), and a way
// back to the same set. Sits above the tab bar and at the foot of pushed screens.
export function ResumeBar({ style }: { style?: StyleProp<ViewStyle> }) {
  const live = useLive();
  const workoutOpen = useWorkoutOpen();
  const [now, setNow] = useState(Date.now());
  const shown = Boolean(live && !workoutOpen);

  useEffect(() => {
    if (!shown) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [shown]);

  if (!live || !shown) return null;
  const resting = live.restEndsAt !== null && live.restEndsAt > now;

  return (
    <Animated.View entering={rise()} style={style}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Resume ${live.dayName}`}
        onPress={() => {
          haptic.press();
          router.push({ pathname: '/workout/[id]', params: { id: live.id } });
        }}
        style={styles.bar}
      >
        <SlantBar width={size.cueMarkWidth * 2} height={size.cueMarkHeight} color={colors.spotterRed} />
        <View style={styles.text}>
          <Text style={styles.day} numberOfLines={1}>
            {live.dayName}
          </Text>
          <Text style={[styles.clock, resting && styles.rest]} numberOfLines={1}>
            {resting ? `rest ${formatClock(live.restEndsAt! - now)}` : formatClock(now - live.startedAt)}
          </Text>
        </View>
        <Text style={styles.resume}>Resume</Text>
        <ArrowRightIcon color={colors.ink} size={size.iconSm} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: size.buttonPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  text: { flex: 1, gap: space[1] },
  day: { ...type.bodyStrong, color: colors.ink },
  clock: { ...type.numeralCaption, color: colors.inkMuted },
  rest: { color: colors.redText },
  resume: { ...type.captionStrong, color: colors.ink },
});
