import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState, type ReactNode } from 'react';
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
import type { Weekday } from '@/db/types';
import {
  finishedSessionsBetween,
  getOpenSession,
  lastTopKg,
  type Session,
} from '@/db/sessions';
import { caughtUpToday, stillOpenDay } from '@/lib/catchUp';
import { monthName, monthRange, previousMonthKey, startOfDay, startOfWeek } from '@/lib/dates';
import { rise, stagger } from '@/lib/motion';
import { dayTitle, daySummary, formatScheme } from '@/lib/scheme';
import { useUpdateNotices } from '@/lib/updateTap';
import { WEEK, today, weekdayLetter, weekdayName } from '@/lib/week';
import { useProfile, useUnits } from '@/state/profile';
import { useUpdates } from '@/state/updates';
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
  sharable: string | null; // the session finished most recently today, if any
  cards: Map<Weekday, string>; // this week's last finished session on each day, for its card
};

export default function TodayScreen() {
  const db = useSQLiteContext();
  const { profile } = useProfile();
  const { available: update } = useUpdates();
  const units = useUnits();
  const [data, setData] = useState<TodayData>();
  useUpdateNotices();

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
          sharable: week.filter((s) => s.startedAt >= dayStart).pop()?.id ?? null,
          // By the day it was done, not the plan day: a day caught up on Saturday is
          // Saturday's card. `week` is oldest first, so the last one on a day wins.
          cards: new Map(week.map((s) => [weekdayOf(s.startedAt), s.id])),
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
        accessibilityLabel={update ? `Profile. ${update.version} is out.` : 'Profile'}
        onPress={() => router.push('/profile')}
        hitSlop={(size.tapTarget - size.avatarS) / 2}
      >
        <Avatar name={profile?.name ?? ''} photoUri={profile?.photoUri ?? null} size={size.avatarS} />
        {/* A new version is out: the details wait in Profile → Updates. */}
        {update && <View style={styles.updateDot} />}
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

  // A day from earlier this week that wasn't trained is still open until the week ends.
  // On a training day it waits quietly under today's session; on a rest day it becomes
  // the session. See lib/catchUp.
  const stillOpen = stillOpenDay(trainingDays, data.doneThisWeek);
  const madeUp = caughtUpToday(trainingDays, data.doneToday);
  const dayNumber = (day: SplitDay) => trainingDays.indexOf(day) + 1;

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
    const done = data.doneToday.has(todayDay.id);
    body = (
      <DayBody
        label={`${weekdayName(weekday)} · Day ${dayNumber(todayDay)}`}
        day={todayDay}
        note={done ? 'done today. good session.' : null}
        split={split}
        data={data}
        startLabel={done ? 'Train again' : 'Start session'}
        onStart={() => start(todayDay)}
        units={units}
        extra={
          !open && stillOpen ? (
            <Animated.View entering={rise(340)}>
              <PressableScale
                accessibilityRole="button"
                accessibilityHint="Starts it instead of today's session"
                onPress={() => start(stillOpen)}
                style={styles.stillOpen}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>
                    {weekdayName(stillOpen.weekday!)}'s {dayTitle(stillOpen)}
                  </Text>
                  <Text style={styles.meta}>still open · tap to do it instead</Text>
                </View>
                <ChevronRightIcon />
              </PressableScale>
            </Animated.View>
          ) : null
        }
      />
    );
  } else if (stillOpen || madeUp) {
    // A rest day is free, so the day that slipped by takes its place. Once it's done,
    // it stays here as done for the rest of the day.
    const day = (stillOpen ?? madeUp)!;
    const done = !stillOpen;
    body = (
      <DayBody
        label={`${weekdayName(weekday)} · Rest`}
        day={day}
        note={done ? 'done today. good session.' : null}
        lead={`From ${weekdayName(day.weekday!)} · Day ${dayNumber(day)}`}
        split={split}
        data={data}
        startLabel={done ? null : 'Start session'}
        onStart={() => start(day)}
        units={units}
      />
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
        <WeekStrip split={split} doneThisWeek={data.doneThisWeek} cards={data.cards} />
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
        {data.sharable && !open && (
          <Animated.View entering={rise(460)}>
            <PressableScale
              accessibilityRole="button"
              accessibilityHint="Opens a card you can save or share"
              onPress={() => router.push({ pathname: '/session/[id]', params: { id: data.sharable! } })}
              style={styles.recap}
            >
              <Text style={styles.rowName}>Today’s session card</Text>
              <ChevronRightIcon />
            </PressableScale>
          </Animated.View>
        )}
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

type DayBodyProps = {
  label: string; // "THURSDAY · DAY 5", or "SATURDAY · REST" for a day carried over
  lead?: string; // where a carried-over day comes from: "From Thursday · Day 5"
  day: SplitDay;
  note: string | null; // e.g. "done today. good session."
  split: Split;
  data: TodayData;
  startLabel: string | null; // null: no start button (a made-up day already done)
  onStart: () => void;
  units: ReturnType<typeof useUnits>;
  extra?: ReactNode; // under the button, e.g. a day that's still open
};

// A training day on Today: its name and summary, the week, the start (or resume) button
// and its exercises with last weights.
function DayBody({ label, lead, day, note, split, data, startLabel, onStart, units, extra }: DayBodyProps) {
  return (
    <>
      <Animated.View entering={rise(90)} style={styles.titleBlock}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.title}>{dayTitle(day)}</Text>
        <Text style={styles.meta}>
          {lead ? `${lead} · ` : ''}
          {daySummary(day)}
          {note ? ` · ${note}` : ''}
        </Text>
      </Animated.View>
      <WeekStrip split={split} doneThisWeek={data.doneThisWeek} cards={data.cards} />
      {data.open ? (
        <ResumeButton session={data.open} />
      ) : day.exercises.length === 0 ? (
        <Animated.View entering={rise(300)}>
          <OutlineButton
            label="Add exercises"
            onPress={() => router.push({ pathname: '/day/[id]', params: { id: day.id } })}
          />
        </Animated.View>
      ) : startLabel ? (
        <Animated.View entering={rise(300)}>
          <StartButton label={startLabel} onPress={onStart} />
        </Animated.View>
      ) : null}
      {extra}
      {day.exercises.length > 0 && (
        <Animated.View entering={rise(380)} style={styles.card}>
          {day.exercises.map((e, i) => {
            const kg = data.lastKg.get(e.exercise.id);
            return (
              <Animated.View key={e.id} entering={rise(stagger(i, 440))}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.exercise.id } })}
                  style={({ pressed }) => [
                    styles.row,
                    i < day.exercises.length - 1 && styles.rowDivider,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{e.exercise.name}</Text>
                    <Text style={styles.meta}>{formatScheme(e)}</Text>
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
// other training days grey, rest days barely there. A day trained this week opens its
// session card, to save or share it later in the week.
function WeekStrip({
  split,
  doneThisWeek,
  cards,
}: {
  split: Split;
  doneThisWeek: Set<string>;
  cards: Map<Weekday, string>;
}) {
  const t = today();
  return (
    <View style={styles.weekBlock}>
      <View style={styles.week} accessibilityLabel="This week">
        {WEEK.map((w, i) => {
          const card = cards.get(w);
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
              <PressableScale
                accessibilityRole={card ? 'button' : undefined}
                accessibilityLabel={card ? `${weekdayName(w)}'s session card` : weekdayName(w)}
                disabled={!card}
                haptic={card ? 'select' : null}
                onPress={() => card && router.push({ pathname: '/session/[id]', params: { id: card } })}
                style={styles.weekTap}
              >
                <SlantBar width={size.weekBar} height={size.stripBar} color={color} />
                <Text style={[styles.weekLetter, (w === t || card) && styles.weekLetterToday]}>
                  {weekdayLetter(w)}
                </Text>
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
      {cards.size > 0 && (
        <Animated.Text entering={rise(stagger(WEEK.length, 160))} style={styles.meta}>
          Tap a day you trained for its card.
        </Animated.Text>
      )}
    </View>
  );
}

// The weekday a moment falls on, in the app's 1 (Monday) to 7 (Sunday).
function weekdayOf(at: number): Weekday {
  const js = new Date(at).getDay();
  return (js === 0 ? 7 : js) as Weekday;
}

function StartButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} haptic="press" style={styles.start}>
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
  updateDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: size.updateDot,
    height: size.updateDot,
    borderRadius: size.updateDot / 2,
    backgroundColor: colors.spotterRed,
    borderWidth: size.ring,
    borderColor: colors.ground,
  },
  titleBlock: { gap: space[1] },
  label: { ...type.labelWide, color: colors.inkMuted },
  title: { ...type.titleL, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  week: { flexDirection: 'row', gap: space[2] },
  weekBlock: { gap: space[3] },
  weekDay: { flex: 1 },
  weekTap: { alignItems: 'center', gap: space[2], minHeight: size.tapTarget },
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
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1 },
  rowName: { ...type.bodyStrong, color: colors.ink },
  kg: { flexDirection: 'row', alignItems: 'baseline', gap: space[1] },
  kgValue: { ...type.numeralR, color: colors.ink },
  stillOpen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: size.buttonPrimary,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
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
