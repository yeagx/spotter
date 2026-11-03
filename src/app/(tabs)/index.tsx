import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Avatar } from '@/components/Avatar';
import { OutlineButton, PrimaryButton } from '@/components/Buttons';
import { ArrowRightIcon, ChevronRightIcon } from '@/components/Icons';
import { Logo } from '@/components/Logo';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { SlantBar } from '@/components/Slant';
import { getSplit, type Split, type SplitDay } from '@/db/plan';
import {
  finishedSessionsBetween,
  getOpenSession,
  lastTopKg,
  type Session,
} from '@/db/sessions';
import { monthName, monthRange, previousMonthKey, startOfDay, startOfWeek } from '@/lib/dates';
import { rise, stagger } from '@/lib/motion';
import { dayTitle, daySummary, formatScheme } from '@/lib/scheme';
import { WEEK, today, weekdayLetter, weekdayName } from '@/lib/week';
import { useProfile, useUnits } from '@/state/profile';
import { colors, radius, size, space, type } from '@/theme';

const TAB_EDGES = ['top', 'right', 'left'] as const;

// The recap for last month is offered on Today for the first week of a new month.
const RECAP_NUDGE_DAYS = 7;

type TodayData = {
  split: Split | null;
  open: Session | null;
  doneToday: Set<string>; // split_day ids finished today
  doneThisWeek: Set<string>;
  lastKg: Map<string, number>;
  recapMonth: string | null;
};

export default function TodayScreen() {
  const db = useSQLiteContext();
  const { profile } = useProfile();
  const units = useUnits();
  const [data, setData] = useState<TodayData>();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const split = await getSplit(db);
        const open = await getOpenSession(db);
        const week = await finishedSessionsBetween(db, startOfWeek(), Date.now() + 1);
        const dayStart = startOfDay();
        const ids = split?.days.flatMap((d) => d.exercises.map((e) => e.exercise.id)) ?? [];
        const lastKg = await lastTopKg(db, [...new Set(ids)]);

        let recapMonth: string | null = null;
        if (new Date().getDate() <= RECAP_NUDGE_DAYS) {
          const key = previousMonthKey();
          const { from, to } = monthRange(key);
          if ((await finishedSessionsBetween(db, from, to)).length) recapMonth = key;
        }

        const dayIds = (list: Session[]) =>
          new Set(list.flatMap((s) => (s.splitDayId ? [s.splitDayId] : [])));
        if (!active) return;
        setData({
          split,
          open,
          doneToday: dayIds(week.filter((s) => s.startedAt >= dayStart)),
          doneThisWeek: dayIds(week),
          lastKg,
          recapMonth,
        });
      })();
      return () => {
        active = false;
      };
    }, [db]),
  );

  const header = (
    <Animated.View entering={rise()} style={styles.top}>
      <Logo height={size.logoS} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Profile"
        onPress={() => router.push('/profile')}
        hitSlop={(size.tapTarget - size.avatarS) / 2}
      >
        <Avatar name={profile?.name ?? ''} photoUri={profile?.photoUri ?? null} size={size.avatarS} />
      </PressableScale>
    </Animated.View>
  );

  if (!data) return <Screen edges={[...TAB_EDGES]}>{header}</Screen>;

  const { split, open } = data;
  const weekday = today();
  const trainingDays = WEEK.flatMap((w) => split?.days.filter((d) => d.weekday === w) ?? []);
  const todayDay = trainingDays.find((d) => d.weekday === weekday) ?? null;
  const nextDay = todayDay ? null : nextTrainingDay(trainingDays);

  const start = (day: SplitDay) => router.push({ pathname: '/start', params: { dayId: day.id } });

  let body;
  if (!split || trainingDays.length === 0) {
    body = (
      <>
        <Animated.View entering={rise(90)} style={styles.titleBlock}>
          <Text style={styles.label}>{weekdayName(weekday)}</Text>
          <Text style={styles.title}>No plan yet</Text>
          <Text style={styles.meta}>Pick the days you train and what you do on each.</Text>
        </Animated.View>
        <Animated.View entering={rise(300)}>
          <PrimaryButton label="Build your split" onPress={() => router.push('/edit-split')} />
        </Animated.View>
      </>
    );
  } else if (todayDay) {
    const n = trainingDays.indexOf(todayDay) + 1;
    const done = data.doneToday.has(todayDay.id);
    body = (
      <>
        <Animated.View entering={rise(90)} style={styles.titleBlock}>
          <Text style={styles.label}>
            {weekdayName(weekday)} · Day {n}
          </Text>
          <Text style={styles.title}>{dayTitle(todayDay)}</Text>
          <Text style={styles.meta}>
            {daySummary(todayDay)}
            {done ? ' · done today. good session.' : ''}
          </Text>
        </Animated.View>
        <WeekStrip split={split} doneThisWeek={data.doneThisWeek} />
        {open ? (
          <ResumeButton session={open} />
        ) : todayDay.exercises.length ? (
          <Animated.View entering={rise(300)}>
            <StartButton label={done ? 'Train again' : 'Start session'} onPress={() => start(todayDay)} />
          </Animated.View>
        ) : (
          <Animated.View entering={rise(300)}>
            <OutlineButton
              label="Add exercises"
              onPress={() => router.push({ pathname: '/day/[id]', params: { id: todayDay.id } })}
            />
          </Animated.View>
        )}
        {todayDay.exercises.length > 0 && (
          <Animated.View entering={rise(380)} style={styles.card}>
            {todayDay.exercises.map((e, i) => {
              const kg = data.lastKg.get(e.exercise.id);
              return (
                <Animated.View key={e.id} entering={rise(stagger(i, 440))}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({ pathname: '/exercise/[id]', params: { id: e.exercise.id } })
                    }
                    style={[styles.row, i < todayDay.exercises.length - 1 && styles.rowDivider]}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>{e.exercise.name}</Text>
                      <Text style={styles.meta}>{formatScheme(e.sets, e.repsMin, e.repsMax)}</Text>
                    </View>
                    {kg !== undefined && (
                      <View style={styles.kg}>
                        <Text style={styles.kgValue}>{units.show(kg)}</Text>
                        <Text style={styles.meta}>{units.units}</Text>
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </Animated.View>
        )}
      </>
    );
  } else {
    body = (
      <>
        <Animated.View entering={rise(90)} style={styles.titleBlock}>
          <Text style={styles.label}>{weekdayName(weekday)} · Rest</Text>
          <Text style={styles.title}>Rest day.</Text>
          {nextDay?.weekday && (
            <Text style={styles.meta}>
              Next: {weekdayName(nextDay.weekday)} · {dayTitle(nextDay)}
            </Text>
          )}
        </Animated.View>
        <WeekStrip split={split} doneThisWeek={data.doneThisWeek} />
        {open ? (
          <ResumeButton session={open} />
        ) : (
          nextDay &&
          nextDay.exercises.length > 0 && (
            <Animated.View entering={rise(300)}>
              <OutlineButton label="Train anyway" onPress={() => start(nextDay)} icon={null} />
            </Animated.View>
          )
        )}
      </>
    );
  }

  return (
    <Screen edges={[...TAB_EDGES]}>
      <View style={styles.content}>
        {header}
        {body}
        {data.recapMonth && (
          <Animated.View entering={rise(500)}>
            <PressableScale
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/recap', params: { month: data.recapMonth! } })}
              style={styles.recap}
            >
              <Text style={styles.rowName}>{monthName(data.recapMonth)} recap</Text>
              <ChevronRightIcon />
            </PressableScale>
          </Animated.View>
        )}
      </View>
    </Screen>
  );
}

// The next training day after today, wrapping around the week.
function nextTrainingDay(days: SplitDay[]): SplitDay | null {
  const from = WEEK.indexOf(today());
  for (let step = 1; step <= WEEK.length; step++) {
    const w = WEEK[(from + step) % WEEK.length];
    const day = days.find((d) => d.weekday === w);
    if (day) return day;
  }
  return null;
}

// Seven slanted bars: today red, days already trained this week white,
// other training days grey, rest days barely there.
function WeekStrip({ split, doneThisWeek }: { split: Split; doneThisWeek: Set<string> }) {
  const t = today();
  return (
    <View style={styles.week} accessibilityLabel="This week">
      {WEEK.map((w, i) => {
        const day = split.days.find((d) => d.weekday === w);
        const color =
          w === t && day
            ? colors.spotterRed
            : day && doneThisWeek.has(day.id)
              ? colors.ink
              : day
                ? colors.inkMuted
                : colors.surfaceRaised;
        return (
          <Animated.View key={w} entering={rise(stagger(i, 160))} style={styles.weekDay}>
            <SlantBar width={size.weekBar} height={size.stripBar} color={color} />
            <Text style={[styles.weekLetter, w === t && styles.weekLetterToday]}>
              {weekdayLetter(w)}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

function StartButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={styles.start}>
      <Text style={styles.startLabel}>{label}</Text>
      <ArrowRightIcon />
    </PressableScale>
  );
}

function ResumeButton({ session }: { session: Session }) {
  return (
    <Animated.View entering={rise(300)}>
      <StartButton
        label="Resume session"
        onPress={() => router.push({ pathname: '/workout/[id]', params: { id: session.id } })}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleBlock: { gap: space[1] },
  label: { ...type.labelWide, color: colors.inkMuted },
  title: { ...type.titleL, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  week: { flexDirection: 'row', gap: space[2] },
  weekDay: { flex: 1, alignItems: 'center', gap: space[2] },
  weekLetter: { ...type.labelWide, color: colors.inkMuted },
  weekLetterToday: { color: colors.ink },
  start: {
    height: size.buttonPrimary,
    borderRadius: radius.md,
    backgroundColor: colors.spotterRed,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4] + space[1],
  },
  startLabel: { ...type.button, color: colors.onRed },
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space[4],
    paddingVertical: space[1],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    minHeight: size.buttonPrimary,
    paddingVertical: space[2],
  },
  rowDivider: { borderBottomWidth: size.divider, borderBottomColor: colors.hairline },
  rowText: { flex: 1 },
  rowName: { ...type.bodyStrong, color: colors.ink },
  kg: { flexDirection: 'row', alignItems: 'baseline', gap: space[1] },
  kgValue: { ...type.numeralR, color: colors.ink },
  recap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: size.tapTarget,
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
});
