import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DemoPlayer } from '@/components/DemoPlayer';
import { FadeScrollView } from '@/components/FadeScrollView';
import { SlantBar, SlantStrip } from '@/components/Slant';
import { StackScreen } from '@/components/StackScreen';
import { TargetsLine } from '@/components/TargetsLine';
import { getExercise } from '@/db/exercises';
import { getSplit, type DayExercise } from '@/db/plan';
import { beats, bestLift, exerciseHistory, type Lift, type SessionTop } from '@/db/sessions';
import type { Exercise } from '@/db/types';
import { exerciseMeta } from '@/lib/labels';
import { rise } from '@/lib/motion';
import { formatReps } from '@/lib/scheme';
import { useUnits } from '@/state/profile';
import { colors, radius, size, space, type } from '@/theme';

type Data = {
  exercise: Exercise;
  planned: DayExercise | null;
  best: Lift | null;
  history: SessionTop[];
  isNewBest: boolean; // the most recent session set the current best
};

// What an exercise looks like, how to do it, and how it's going.
export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const units = useUnits();
  const [data, setData] = useState<Data | null>();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    (async () => {
      const exercise = await getExercise(db, id);
      if (!exercise) {
        setData(null);
        return;
      }
      const split = await getSplit(db);
      const planned =
        split?.days.flatMap((d) => d.exercises).find((e) => e.exercise.id === id) ?? null;
      const best = await bestLift(db, id);
      const history = await exerciseHistory(db, id, 6);
      const latest = history[history.length - 1];
      const before = latest ? await bestLift(db, id, latest.sessionId) : null;
      setData({
        exercise,
        planned,
        best,
        history,
        isNewBest: Boolean(latest && before && beats(latest, before)),
      });
    })();
  }, [db, id]);

  if (data === null) {
    return (
      <StackScreen label="Exercise">
        <Text style={styles.meta}>This exercise isn’t in your library anymore.</Text>
      </StackScreen>
    );
  }
  if (!data) return <StackScreen label="">{null}</StackScreen>;

  const { exercise, planned, best, history } = data;
  // Bodyweight moves are tracked by reps, everything else by weight.
  const byReps = history.length > 0 && history.every((h) => h.kg === 0);
  const metric = (l: Lift) => (byReps ? l.reps : l.kg);
  const top = Math.max(1, ...history.map(metric));

  return (
    // Muscle and equipment, e.g. "Back · Cable" (a bare "Back" beside the back arrow
    // reads like a button).
    <StackScreen label={exerciseMeta(exercise)}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={rise(80)} style={styles.titleBlock}>
          <Text style={styles.title}>{exercise.name}</Text>
          <TargetsLine exercise={exercise} />
          {planned && (
            <Text style={styles.meta}>
              {planned.sets} sets · {formatReps(planned.repsMin, planned.repsMax)} reps
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={rise(160)} style={styles.demo}>
          <DemoPlayer media={exercise.media} slow={slow} extraPill={slow ? '0.5×' : null} />
          {exercise.media && (
            <View style={styles.demoFoot}>
              <Text style={styles.meta}>Tap to pause · no sound, ever</Text>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: slow }}
                onPress={() => setSlow((s) => !s)}
                hitSlop={space[3]}
              >
                <Text style={[styles.speed, slow && styles.speedOn]}>Half speed</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {exercise.cues.length > 0 && (
          <Animated.View entering={rise(240)} style={styles.section}>
            <Text style={styles.label}>Form</Text>
            <View style={styles.cues}>
              {exercise.cues.map((cue) => (
                <View key={cue} style={styles.cue}>
                  <SlantBar width={size.cueMarkWidth} height={size.cueMarkHeight} color={colors.inkMuted} />
                  <Text style={styles.cueText}>{cue}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        <Animated.View entering={rise(320)} style={styles.card}>
          <View style={styles.bestHead}>
            <View style={styles.titleBlock}>
              <Text style={styles.label}>Best</Text>
              {best ? (
                <View style={styles.bestValue}>
                  <Text style={styles.bestNumber} numberOfLines={1} adjustsFontSizeToFit>
                    {byReps ? best.reps : units.show(best.kg)}
                  </Text>
                  <Text style={styles.meta}>{byReps ? 'reps' : `${units.units} × ${best.reps}`}</Text>
                </View>
              ) : (
                <Text style={styles.meta}>Log it once and your best shows here.</Text>
              )}
            </View>
            {data.isNewBest && <Text style={styles.newBest}>new best</Text>}
          </View>
          {history.length > 0 && (
            <>
              <SlantStrip
                height={size.chartHistory}
                gap={space[2]}
                bars={history.map((h, i) => ({
                  color: i === history.length - 1 ? colors.spotterRed : colors.inkMuted,
                  // Floor at 30% so a light day still reads as a bar.
                  value: 0.3 + 0.7 * (metric(h) / top),
                }))}
              />
              <Text style={styles.meta}>
                Last {history.length} {history.length === 1 ? 'session' : 'sessions'}
              </Text>
            </>
          )}
        </Animated.View>
      </FadeScrollView>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6], paddingTop: space[2] },
  titleBlock: { gap: space[1], flexShrink: 1 },
  title: { ...type.titleL, color: colors.ink },
  label: { ...type.labelWide, color: colors.inkMuted },
  meta: { ...type.caption, color: colors.inkMuted },
  demo: { gap: space[2] },
  demoFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3] },
  speed: { ...type.captionStrong, color: colors.ink },
  speedOn: { color: colors.redText },
  section: { gap: space[3] },
  cues: { gap: space[2] },
  cue: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  cueText: { ...type.body, color: colors.ink, flex: 1 },
  card: { gap: space[4], padding: space[4], borderRadius: radius.md, backgroundColor: colors.surface },
  bestHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[3] },
  bestValue: { flexDirection: 'row', alignItems: 'baseline', gap: space[1] },
  bestNumber: { ...type.numeralL, color: colors.ink, flexShrink: 1 },
  newBest: { ...type.captionStrong, color: colors.redText },
});
