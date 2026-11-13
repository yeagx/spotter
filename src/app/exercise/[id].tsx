import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DemoPlayer } from '@/components/DemoPlayer';
import { ExerciseNote } from '@/components/ExerciseNote';
import { FadeScrollView } from '@/components/FadeScrollView';
import { SlantBar, SlantStrip } from '@/components/Slant';
import { StackScreen } from '@/components/StackScreen';
import { TargetsLine } from '@/components/TargetsLine';
import { TrendChart } from '@/components/TrendChart';
import { getExercise, setCustomExerciseMedia } from '@/db/exercises';
import { getSplit, type DayExercise } from '@/db/plan';
import {
  beats,
  bestLift,
  exerciseHistory,
  exerciseSessions,
  type ExerciseSession,
  type Lift,
  type SessionTop,
} from '@/db/sessions';
import type { Exercise } from '@/db/types';
import { confirmDestructive, notify } from '@/lib/confirm';
import { formatDay, localDate } from '@/lib/dates';
import { PICK_PROBLEMS, pickExerciseMedia, removeExerciseMedia } from '@/lib/exerciseMedia';
import { haptic } from '@/lib/haptics';
import { exerciseMeta } from '@/lib/labels';
import { rise } from '@/lib/motion';
import { schemeLine } from '@/lib/scheme';
import { formatLift, trendMetric } from '@/lib/tracking';
import { formatNumber } from '@/lib/units';
import { useUnits } from '@/state/profile';
import { colors, radius, size, space, type } from '@/theme';

// The bars show the last few sessions; the line and the list reach further back.
const STRIP_SESSIONS = 6;
const TREND_SESSIONS = 12;
const LISTED_SESSIONS = 5;

type Data = {
  exercise: Exercise;
  planned: DayExercise | null;
  best: Lift | null;
  history: SessionTop[]; // top set per session, oldest first
  recent: ExerciseSession[]; // every set of the last few sessions, newest first
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
      const history = await exerciseHistory(db, id, TREND_SESSIONS);
      const recent = await exerciseSessions(db, id, LISTED_SESSIONS);
      const latest = history[history.length - 1];
      const before = latest ? await bestLift(db, id, latest.sessionId) : null;
      setData({
        exercise,
        planned,
        best,
        history,
        recent,
        isNewBest: Boolean(latest && before && beats(latest, before, exercise.tracking)),
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

  const { exercise, planned, best, history, recent } = data;
  // The number the bars and trend follow: weight, reps, seconds, or distance / minutes.
  const trend = trendMetric(exercise.tracking, history, units);
  const metric = trend.value;
  const strip = history.slice(-STRIP_SESSIONS);
  const top = Math.max(1, ...strip.map(metric));
  const change = history.length >= 2 ? metric(history[history.length - 1]) - metric(history[0]) : 0;
  const day = (ms: number) => formatDay(localDate(new Date(ms)));
  const showSet = (l: Lift) => formatLift(l, exercise.tracking, units, true);
  // The best as a big number and what follows it: "60" + "kg × 8", "45" + "s".
  const bestRest = (l: Lift) => {
    const full = formatLift(l, exercise.tracking, units);
    const number = trend.show(l);
    return full.startsWith(number) ? full.slice(number.length).trim() : trend.unit;
  };

  // Only your own exercises take a photo or clip; the library's demos are bundled.
  const loops = exercise.media !== null && !(exercise.media.type === 'file' && exercise.media.kind === 'image');
  const setMedia = (media: Exercise['media']) => setData({ ...data, exercise: { ...exercise, media } });

  const attach = async () => {
    const picked = await pickExerciseMedia();
    if (!picked) return;
    if ('problem' in picked) {
      notify(...PICK_PROBLEMS[picked.problem]);
      return;
    }
    try {
      await setCustomExerciseMedia(db, exercise.id, picked.media);
      removeExerciseMedia(exercise.media); // the one it replaces
      setMedia(picked.media);
    } catch {
      removeExerciseMedia(picked.media);
      notify('Couldn’t add that', 'Try again.');
    }
  };

  const detach = async () => {
    const ok = await confirmDestructive({
      title: 'Remove this demo?',
      message: 'The photo or clip comes off this exercise. Your logs stay.',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    await setCustomExerciseMedia(db, exercise.id, null);
    removeExerciseMedia(exercise.media);
    setMedia(null);
  };

  return (
    // Muscle and equipment, e.g. "Back · Cable" (a bare "Back" beside the back arrow
    // reads like a button).
    <StackScreen label={exerciseMeta(exercise)}>
      <FadeScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={rise(80)} style={styles.titleBlock}>
          <Text style={styles.title}>{exercise.name}</Text>
          <TargetsLine exercise={exercise} />
          {planned && (
            <Text style={styles.meta}>{schemeLine(planned)}</Text>
          )}
        </Animated.View>

        <Animated.View entering={rise(160)} style={styles.demo}>
          <DemoPlayer media={exercise.media} slow={slow} extraPill={slow ? '0.5×' : null} />
          {loops && (
            <View style={styles.demoFoot}>
              <Text style={styles.meta}>Tap to pause · no sound, ever</Text>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: slow }}
                onPress={() => {
                  haptic.select();
                  setSlow((s) => !s);
                }}
                hitSlop={space[3]}
              >
                <Text style={[styles.speed, slow && styles.speedOn]}>Half speed</Text>
              </Pressable>
            </View>
          )}
          {exercise.isCustom && (
            <View style={styles.demoFoot}>
              <Pressable accessibilityRole="button" onPress={attach} hitSlop={space[3]}>
                <Text style={styles.speed}>
                  {exercise.media ? 'Change photo or clip' : 'Add a photo, GIF or clip'}
                </Text>
              </Pressable>
              {exercise.media && (
                <Pressable accessibilityRole="button" onPress={detach} hitSlop={space[3]}>
                  <Text style={styles.meta}>Remove</Text>
                </Pressable>
              )}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={rise(220)} style={styles.section}>
          <Text style={styles.label}>Your note</Text>
          <ExerciseNote exerciseId={exercise.id} />
        </Animated.View>

        {exercise.cues.length > 0 && (
          <Animated.View entering={rise(280)} style={styles.section}>
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

        <Animated.View entering={rise(340)} style={styles.card}>
          <View style={styles.bestHead}>
            <View style={styles.titleBlock}>
              <Text style={styles.label}>Best</Text>
              {best ? (
                <View style={styles.bestValue}>
                  <Text style={styles.bestNumber} numberOfLines={1} adjustsFontSizeToFit>
                    {trend.show(best)}
                  </Text>
                  <Text style={styles.meta}>{bestRest(best)}</Text>
                </View>
              ) : (
                <Text style={styles.meta}>Log it once and your best shows here.</Text>
              )}
            </View>
            {data.isNewBest && <Text style={styles.newBest}>new best</Text>}
          </View>
          {strip.length > 0 && (
            <>
              <SlantStrip
                grow
                delay={500}
                height={size.chartHistory}
                gap={space[2]}
                bars={strip.map((h, i) => ({
                  color: i === strip.length - 1 ? colors.spotterRed : colors.inkMuted,
                  // Floor at 30% so a light day still reads as a bar.
                  value: 0.3 + 0.7 * (metric(h) / top),
                }))}
              />
              <Text style={styles.meta}>
                Last {strip.length} {strip.length === 1 ? 'session' : 'sessions'}
              </Text>
            </>
          )}
        </Animated.View>

        {recent.length > 0 && (
          <Animated.View entering={rise(420)} style={styles.card}>
            <Text style={styles.label}>History</Text>
            {history.length >= 2 && (
              <>
                <TrendChart values={history.map(metric)} delay={600} />
                <Text style={styles.meta}>
                  Top set · {signed(change)} {trend.unit} since {day(history[0].doneAt)}
                </Text>
              </>
            )}
            <View>
              {recent.map((s, i) => (
                <View key={s.sessionId} style={[styles.session, i > 0 && styles.sessionDivider]}>
                  <Text style={styles.sessionDay}>{day(s.at)}</Text>
                  <Text style={styles.sessionSets}>{s.sets.map(showSet).join('  ·  ')}</Text>
                </View>
              ))}
            </View>
            {trend.unit !== 's' && exercise.tracking !== 'cardio' && (
              <Text style={styles.meta}>
                {trend.unit === 'reps' ? 'Reps' : `${units.units} × reps`}, set by set.
              </Text>
            )}
          </Animated.View>
        )}
      </FadeScrollView>
    </StackScreen>
  );
}

// "+2.5" / "−5" with a real minus sign; "0" for no change.
function signed(n: number) {
  const r = Number(formatNumber(n));
  if (r === 0) return '0';
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`;
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
  section: { gap: space[2] },
  cues: { gap: space[2] },
  cue: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  cueText: { ...type.body, color: colors.ink, flex: 1 },
  card: { gap: space[4], padding: space[4], borderRadius: radius.md, backgroundColor: colors.surface },
  bestHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[3] },
  bestValue: { flexDirection: 'row', alignItems: 'baseline', gap: space[1] },
  bestNumber: { ...type.numeralL, color: colors.ink, flexShrink: 1 },
  newBest: { ...type.captionStrong, color: colors.redText },
  session: { flexDirection: 'row', alignItems: 'baseline', gap: space[3], paddingVertical: space[3] },
  sessionDivider: { borderTopWidth: size.divider, borderTopColor: colors.hairline },
  sessionDay: { ...type.bodyStrong, color: colors.ink, minWidth: size.thumb },
  sessionSets: { ...type.numeralCaption, color: colors.inkMuted, flex: 1 },
});
