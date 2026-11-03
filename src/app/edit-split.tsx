import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PrimaryButton } from '@/components/Buttons';
import { FadeScrollView } from '@/components/FadeScrollView';
import { ChevronRightIcon } from '@/components/Icons';
import { PressableScale } from '@/components/PressableScale';
import { StackScreen } from '@/components/StackScreen';
import { TextField } from '@/components/TextField';
import { getSplit, saveSplit, type SplitDay } from '@/db/plan';
import type { Weekday } from '@/db/types';
import { confirmDestructive } from '@/lib/confirm';
import { rise, settle, stagger } from '@/lib/motion';
import { dayTitle, daySummary } from '@/lib/scheme';
import { WEEK, inWeekOrder, weekdayLetter, weekdayName, weekdayShort } from '@/lib/week';
import { colors, radius, size, space, type } from '@/theme';

const FALLBACK_NAME = 'My split';

// Name the split and pick its training days. Changes are a draft until Save.
// Opening a day saves first, so the day exists to edit and nothing here is lost.
export default function EditSplitScreen() {
  const db = useSQLiteContext();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [on, setOn] = useState<Set<Weekday>>(new Set());
  const [saved, setSaved] = useState<SplitDay[]>([]); // as stored, for names and summaries
  const [busy, setBusy] = useState(false);

  // Reload on focus so names and counts are fresh after editing a day.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSplit(db).then((split) => {
        if (!active) return;
        setName(split?.name ?? '');
        setOn(new Set(split?.days.flatMap((d) => (d.weekday ? [d.weekday] : []))));
        setSaved(split?.days ?? []);
        setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  const toggle = (d: Weekday) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  // Writes the draft. Asks first if switching days off would delete their exercises.
  const persist = async () => {
    const dropped = saved.filter((d) => d.weekday && !on.has(d.weekday) && d.exercises.length);
    if (dropped.length) {
      const days = dropped.map((d) => weekdayName(d.weekday!)).join(' and ');
      const count = dropped.reduce((n, d) => n + d.exercises.length, 0);
      const ok = await confirmDestructive({
        title: `Remove ${days}?`,
        message: `${count} ${count === 1 ? 'exercise goes' : 'exercises go'} with ${
          dropped.length === 1 ? 'it' : 'them'
        }. Past sessions stay.`,
        confirmLabel: 'Remove',
      });
      if (!ok) return false;
    }
    await saveSplit(db, { name: name.trim() || FALLBACK_NAME, weekdays: inWeekOrder(on) });
    return true;
  };

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      if (await persist()) router.back();
    });

  const openDay = (weekday: Weekday) =>
    run(async () => {
      if (!(await persist())) return;
      const day = (await getSplit(db))?.days.find((d) => d.weekday === weekday);
      if (day) router.push({ pathname: '/day/[id]', params: { id: day.id } });
    });

  const days = inWeekOrder(on);

  return (
    <StackScreen
      label="Edit split"
      footer={<PrimaryButton label="Save split" onPress={save} disabled={!loaded || busy} />}
    >
      {loaded && (
        <FadeScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={rise(80)}>
            <TextField
              label="Split name"
              value={name}
              onChangeText={setName}
              placeholder={FALLBACK_NAME}
              textStyle={type.title}
              returnKeyType="done"
              maxLength={40}
            />
          </Animated.View>

          <Animated.View entering={rise(160)} style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.label}>Training days</Text>
              <Text style={styles.meta}>{days.length} per week</Text>
            </View>
            <View style={styles.week}>
              {WEEK.map((d) => {
                const active = on.has(d);
                return (
                  <PressableScale
                    key={d}
                    accessibilityRole="switch"
                    accessibilityLabel={weekdayName(d)}
                    accessibilityState={{ checked: active }}
                    onPress={() => toggle(d)}
                    style={[styles.weekday, active && styles.weekdayOn]}
                  >
                    <Text style={[styles.weekdayText, active && styles.weekdayTextOn]}>
                      {weekdayLetter(d)}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </Animated.View>

          {days.length > 0 && (
            <View style={styles.list}>
              <Animated.Text entering={rise(220)} style={styles.label}>
                Days
              </Animated.Text>
              {days.map((d, i) => {
                const day = saved.find((s) => s.weekday === d);
                return (
                  <Animated.View key={d} entering={rise(stagger(i, 260))} layout={settle}>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityHint="Saves the split, then opens this day"
                      onPress={() => openDay(d)}
                      style={styles.dayRow}
                    >
                      <Text style={styles.dayLabel}>{weekdayShort(d)}</Text>
                      <View style={styles.dayText}>
                        <Text style={styles.dayName}>{day ? dayTitle(day) : 'New day'}</Text>
                        <Text style={styles.meta}>
                          {day ? daySummary(day) : daySummary({ exercises: [] })}
                        </Text>
                      </View>
                      <ChevronRightIcon />
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </FadeScrollView>
      )}
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6], paddingTop: space[2] },
  section: { gap: space[3] },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2] },
  label: { ...type.labelWide, color: colors.inkMuted },
  meta: { ...type.caption, color: colors.inkMuted },
  week: { flexDirection: 'row', gap: space[2] },
  weekday: {
    flex: 1,
    minHeight: size.tapTarget,
    paddingVertical: space[2],
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayOn: { backgroundColor: colors.spotterRed },
  weekdayText: { ...type.labelWide, color: colors.inkMuted },
  weekdayTextOn: { color: colors.onRed },
  list: { gap: space[2] },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: size.tapTarget,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  dayLabel: { ...type.labelWide, color: colors.inkMuted, minWidth: size.dayColumn },
  dayText: { flex: 1 },
  dayName: { ...type.heading, color: colors.ink },
});
