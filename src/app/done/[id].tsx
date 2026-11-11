import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Keyframe, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OutlineButton } from '@/components/Buttons';
import { ShareIcon } from '@/components/Icons';
import { getSession, listSetLogs, newBestsIn } from '@/db/sessions';
import { formatClock } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { easeOut, rise, webSafe } from '@/lib/motion';
import { colors, motion, space, type } from '@/theme';

type Summary = { exercises: number; sets: number; minutes: string; bests: number };

const fadeIn = (delay: number) =>
  webSafe(
    new Keyframe({ 0: { opacity: 0 }, 100: { opacity: 1, easing: easeOut } })
      .delay(delay)
      .duration(motion.fadeMs)
      .reduceMotion(ReduceMotion.System),
    delay,
  );

// Shown once after finishing. Says little: what was done, and any new bests.
export default function DoneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<Summary>();

  useEffect(() => {
    (async () => {
      const session = await getSession(db, id);
      const logs = await listSetLogs(db, id);
      const bests = await newBestsIn(db, id);
      setSummary({
        exercises: new Set(logs.map((l) => l.exerciseId)).size,
        sets: logs.length,
        minutes: formatClock((session?.finishedAt ?? Date.now()) - (session?.startedAt ?? Date.now())),
        bests: bests.length,
      });
      haptic.success();
    })();
  }, [db, id]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Animated.Text entering={rise(100)} style={styles.done}>
            good session.
          </Animated.Text>
          {summary && (
            <Animated.View entering={rise(400)} style={styles.lines}>
              <Text style={styles.meta}>
                {summary.exercises} {summary.exercises === 1 ? 'exercise' : 'exercises'} · {summary.sets}{' '}
                {summary.sets === 1 ? 'set' : 'sets'} · {summary.minutes}
              </Text>
              {summary.bests > 0 && (
                <Text style={styles.best}>
                  {summary.bests} {summary.bests === 1 ? 'new best' : 'new bests'}
                </Text>
              )}
            </Animated.View>
          )}
        </View>
        <Animated.View entering={fadeIn(1200)} style={styles.foot}>
          {summary && summary.sets > 0 && (
            <OutlineButton
              label="Share this session"
              icon={<ShareIcon color={colors.ink} />}
              onPress={() => router.replace({ pathname: '/session/[id]', params: { id } })}
            />
          )}
          <Text style={styles.hint}>Tap anywhere to close</Text>
        </Animated.View>
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  safe: { flex: 1, paddingBottom: space[8], paddingHorizontal: space[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3] },
  done: { ...type.numeralS, color: colors.ink, textAlign: 'center' },
  lines: { alignItems: 'center', gap: space[1] },
  meta: { ...type.caption, color: colors.inkMuted, textAlign: 'center' },
  best: { ...type.captionStrong, color: colors.redText },
  foot: { gap: space[4] },
  hint: { ...type.labelWide, color: colors.inkMuted, textAlign: 'center' },
});
