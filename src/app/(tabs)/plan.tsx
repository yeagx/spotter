import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PrimaryButton, SmallButton } from '@/components/Buttons';
import { ExpandChevron } from '@/components/ExpandChevron';
import { ArrowRightIcon, PlusIcon } from '@/components/Icons';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { addExercisesToDay, getSplit, type Split, type SplitDay } from '@/db/plan';
import { getOpenSession, type Session } from '@/db/sessions';
import type { Weekday } from '@/db/types';
import { openLibrary } from '@/lib/libraryPicker';
import { rise, settle, stagger } from '@/lib/motion';
import { dayTitle, daySummary, formatScheme } from '@/lib/scheme';
import { WEEK, today, weekdayName, weekdayShort } from '@/lib/week';
import { colors, radius, size, space, type } from '@/theme';

const TAB_EDGES = ['top', 'right', 'left'] as const;

export default function PlanScreen() {
  const db = useSQLiteContext();
  // undefined while loading, null when no split exists yet.
  const [split, setSplit] = useState<Split | null>();
  const [openDayId, setOpenDayId] = useState<string | null>(null);
  // A session in progress: starting another day would leave it hanging, so days offer
  // to resume it instead.
  const [running, setRunning] = useState<Session | null>(null);
  const firstLoad = useRef(true);

  // Reload on every focus: Edit split, Edit day and the library all change the plan.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getOpenSession(db).then((o) => active && setRunning(o));
      getSplit(db).then((s) => {
        if (!active) return;
        setSplit(s);
        // Open today's day the first time, so the plan answers "what am I doing today?".
        if (firstLoad.current) {
          firstLoad.current = false;
          setOpenDayId(s?.days.find((d) => d.weekday === today())?.id ?? null);
        }
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  if (split === undefined) return <Screen edges={[...TAB_EDGES]}>{null}</Screen>;

  if (split === null) {
    return (
      <Screen
        edges={[...TAB_EDGES]}
        footer={<PrimaryButton label="Build your split" onPress={() => router.push('/edit-split')} />}
      >
        <Animated.View entering={rise()} style={styles.titleBlock}>
          <Text style={styles.label}>Your split</Text>
          <Text style={styles.title}>No split yet</Text>
          <Text style={styles.meta}>Pick the days you train, then fill each one.</Text>
        </Animated.View>
      </Screen>
    );
  }

  const addTo = (day: SplitDay) =>
    openLibrary({
      dayLabel: day.weekday ? weekdayName(day.weekday) : dayTitle(day),
      existingIds: day.exercises.map((e) => e.exercise.id),
      onAdd: (exercises) => addExercisesToDay(db, day.id, exercises),
    });

  const trainingDays = split.days.filter((d) => d.weekday !== null).length;

  return (
    <Screen edges={[...TAB_EDGES]}>
      <View style={styles.content}>
        <Animated.View entering={rise()} style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.label}>
              Your split · {trainingDays} {trainingDays === 1 ? 'day' : 'days'}
            </Text>
            <Text style={styles.title}>{split.name}</Text>
          </View>
          <SmallButton label="Edit" onPress={() => router.push('/edit-split')} />
        </Animated.View>

        <View style={styles.days}>
          {WEEK.map((weekday, i) => {
            const day = split.days.find((d) => d.weekday === weekday);
            const delay = stagger(i, 80);
            if (!day) return <RestRow key={weekday} weekday={weekday} delay={delay} />;
            const open = openDayId === day.id;
            return (
              <DayCard
                key={day.id}
                day={day}
                weekday={weekday}
                delay={delay}
                open={open}
                onToggle={() => setOpenDayId(open ? null : day.id)}
                onAdd={() => addTo(day)}
                onStart={() =>
                  running
                    ? router.push({ pathname: '/workout/[id]', params: { id: running.id } })
                    : router.push({ pathname: '/start', params: { dayId: day.id } })
                }
                startLabel={running ? 'Resume session in progress' : 'Start this day'}
              />
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

type DayCardProps = {
  day: SplitDay;
  weekday: Weekday;
  delay: number;
  open: boolean;
  onToggle: () => void;
  onAdd: () => void;
  // Any day can be trained on any day: swapped, doubled up, or done on the road.
  onStart: () => void;
  startLabel: string;
};

function DayCard({ day, weekday, delay, open, onToggle, onAdd, onStart, startLabel }: DayCardProps) {
  return (
    <Animated.View entering={rise(delay)} layout={settle} style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={styles.dayRow}
      >
        <DayLabel weekday={weekday} />
        <View style={styles.dayText}>
          <Text style={styles.dayName}>{dayTitle(day)}</Text>
          <Text style={styles.meta}>{daySummary(day)}</Text>
        </View>
        <ExpandChevron open={open} />
      </Pressable>

      {open && (
        <View style={styles.exercises}>
          {day.exercises.map((e, j) => (
            <Animated.View key={e.id} entering={rise(stagger(j))}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/exercise/[id]', params: { id: e.exercise.id } })
                }
                style={styles.exerciseRow}
              >
                <Text style={styles.exerciseName}>{e.exercise.name}</Text>
                <Text style={styles.scheme}>{formatScheme(e)}</Text>
              </Pressable>
            </Animated.View>
          ))}
          <PressableScale accessibilityRole="button" onPress={onAdd} style={styles.addRow}>
            <PlusIcon />
            <Text style={styles.addLabel}>Add exercise</Text>
          </PressableScale>
          {day.exercises.length > 0 && (
            <PressableScale accessibilityRole="button" onPress={onStart} style={styles.startRow}>
              <Text style={styles.startLabel}>{startLabel}</Text>
              <ArrowRightIcon color={colors.ink} />
            </PressableScale>
          )}
        </View>
      )}
    </Animated.View>
  );
}

function RestRow({ weekday, delay }: { weekday: Weekday; delay: number }) {
  return (
    <Animated.View entering={rise(delay)} layout={settle} style={styles.restRow}>
      <DayLabel weekday={weekday} />
      <Text style={styles.restName}>Rest</Text>
    </Animated.View>
  );
}

// Today's label is the one touch of red on the screen.
function DayLabel({ weekday }: { weekday: Weekday }) {
  return (
    <Text style={[styles.dayLabel, weekday === today() && styles.dayLabelToday]}>
      {weekdayShort(weekday)}
    </Text>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space[4],
  },
  titleBlock: { flexShrink: 1, gap: space[1] },
  label: { ...type.labelWide, color: colors.inkMuted },
  title: { ...type.titleL, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  days: { gap: space[2] },
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: size.tapTarget,
  },
  dayLabel: { ...type.labelWide, color: colors.inkMuted, minWidth: size.dayColumn },
  dayLabelToday: { color: colors.redText },
  dayText: { flex: 1 },
  dayName: { ...type.heading, color: colors.ink },
  // Indented to line up under the day name.
  exercises: {
    paddingLeft: space[4] + size.dayColumn + space[3],
    paddingRight: space[4],
    paddingBottom: space[3],
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    minHeight: size.tapTarget,
    paddingVertical: space[2],
    borderTopWidth: size.divider,
    borderTopColor: colors.hairline,
  },
  exerciseName: { ...type.body, color: colors.ink, flexShrink: 1 },
  scheme: { ...type.caption, color: colors.inkMuted },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: size.tapTarget,
    borderTopWidth: size.divider,
    borderTopColor: colors.hairline,
  },
  addLabel: { ...type.bodyStrong, color: colors.inkMuted },
  startRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    minHeight: size.tapTarget,
    borderTopWidth: size.divider,
    borderTopColor: colors.hairline,
  },
  startLabel: { ...type.bodyStrong, color: colors.ink, flexShrink: 1 },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: size.tapTarget,
    paddingHorizontal: space[4],
  },
  restName: { ...type.body, color: colors.inkMuted },
});
