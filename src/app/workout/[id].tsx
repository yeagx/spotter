import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/Buttons';
import { DemoPlayer } from '@/components/DemoPlayer';
import { DrawnCheck } from '@/components/DrawnCheck';
import { ExerciseNote } from '@/components/ExerciseNote';
import { FOOTER_CLEARANCE, FadeScrollView } from '@/components/FadeScrollView';
import { CheckIcon, CloseIcon, PlusIcon, SwapIcon } from '@/components/Icons';
import { PinnedFooter } from '@/components/PinnedFooter';
import { PlateLine } from '@/components/PlateLine';
import { PressableScale } from '@/components/PressableScale';
import { SlantStrip } from '@/components/Slant';
import { TargetsLine } from '@/components/TargetsLine';
import { getExercise } from '@/db/exercises';
import { getDay, type DayExercise } from '@/db/plan';
import {
  beats,
  bestLift,
  deleteSetLog,
  endSession,
  getSession,
  getSessionOrder,
  getSetCounts,
  getSwaps,
  lastSets,
  listSetLogs,
  removeSet,
  saveSetCount,
  saveSessionOrder,
  saveSetLog,
  saveSwap,
  type Lift,
} from '@/db/sessions';
import type { Exercise, Tracking } from '@/db/types';
import { confirmDestructive, notify } from '@/lib/confirm';
import { formatClock } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { easeOut, rise, stagger } from '@/lib/motion';
import { cancelRestEnd, playRestDone, prepareRestAlerts, scheduleRestEnd } from '@/lib/restAlert';
import { formatRest, schemeLine } from '@/lib/scheme';
import { openSwap } from '@/lib/swapPicker';
import { formatLift, type UnitsView } from '@/lib/tracking';
import { formatNumber, parseDecimal, parseWhole } from '@/lib/units';
import { useContentColumn } from '@/hooks/useContentColumn';
import { useProfile, useUnits } from '@/state/profile';
import { colors, layout, motion, radius, size, space, type } from '@/theme';

// One set row. The fields hold what's on screen (in the user's units) so typing is
// free; which ones show depends on what the exercise tracks. `time` is seconds for a
// hold and minutes for cardio. `logId` is set once the set is ticked and saved.
type Row = { kg: string; reps: string; time: string; dist: string; logId: string | null };
type FieldKey = Exclude<keyof Row, 'logId'>;

type Field = {
  key: FieldKey;
  head: string; // column title
  unit: string; // beside each number
  keyboard: 'decimal-pad' | 'number-pad';
  maxLength: number;
};

type Units = UnitsView & {
  toKg: (value: number) => number;
  toM: (value: number) => number;
};

// The columns of a set row: kg × reps, reps, seconds, or minutes and distance.
function fieldsFor(tracking: Tracking, u: Units): Field[] {
  const reps: Field = { key: 'reps', head: 'Reps', unit: 'reps', keyboard: 'number-pad', maxLength: 3 };
  switch (tracking) {
    case 'reps':
      return [reps];
    case 'time':
      return [{ key: 'time', head: 'Time', unit: 's', keyboard: 'number-pad', maxLength: 4 }];
    case 'cardio':
      return [
        { key: 'time', head: 'Time', unit: 'min', keyboard: 'decimal-pad', maxLength: 5 },
        { key: 'dist', head: 'Distance', unit: u.dist, keyboard: 'decimal-pad', maxLength: 6 },
      ];
    default:
      return [{ key: 'kg', head: u.units, unit: u.units, keyboard: 'decimal-pad', maxLength: 6 }, reps];
  }
}

// What a logged set looks like typed back into a row.
function toRow(l: Lift, tracking: Tracking, u: Units, logId: string | null = null): Row {
  return {
    kg: tracking === 'weight' ? u.show(l.kg) : '',
    reps: String(l.reps),
    time: tracking === 'time' ? String(l.sec) : tracking === 'cardio' ? formatNumber(l.sec / 60) : '',
    dist: l.m > 0 ? u.showDist(l.m) : '',
    logId,
  };
}

// Reads a row's typed numbers, or null if what's needed is missing. An empty kg is
// bodyweight (0); an empty distance just wasn't measured.
function readRow(row: Row, tracking: Tracking, u: Units): Lift | null {
  const none = { kg: 0, reps: 0, sec: 0, m: 0 };
  switch (tracking) {
    case 'reps': {
      const reps = parseWhole(row.reps);
      return reps ? { ...none, reps } : null;
    }
    case 'time': {
      const sec = parseWhole(row.time);
      return sec ? { ...none, sec } : null;
    }
    case 'cardio': {
      const min = parseDecimal(row.time);
      const dist = row.dist.trim() === '' ? 0 : parseDecimal(row.dist);
      if (!min || dist === null) return null;
      return { ...none, sec: Math.round(min * 60), m: Math.round(u.toM(dist)) };
    }
    default: {
      const value = row.kg.trim() === '' ? 0 : parseDecimal(row.kg);
      const reps = parseWhole(row.reps);
      if (value === null || !reps) return null;
      return { ...none, kg: u.toKg(value), reps };
    }
  }
}

const MISSING: Record<Tracking, string> = {
  weight: 'Enter the weight and reps for this set.',
  reps: 'Enter the reps for this set.',
  time: 'Enter how long you held it, in seconds.',
  cardio: 'Enter how many minutes. Distance is optional.',
};

type Block = {
  item: DayExercise; // `item.exercise` is what's being done: the planned one, or a swap
  planned: Exercise; // what the plan says, so a swap can be told apart and undone
  rows: Row[];
  bestBefore: Lift | null; // best from earlier sessions, for "new best."
  lastTop: Lift | null; // top set last time, for "last time 20 kg × 10"
};

const NEW_BEST_MS = 4000;
const EXTRA_REST_MS = 15000;
const TICK_MS = 500;
// Coming back to the app well after rest ran out, the alert has already gone off; the
// in-app sound would only be a second, late one.
const LATE_MS = 2000;

const isDone = (b: Block) => b.rows.every((r) => r.logId);

const topOf = (sets: Lift[], tracking: Tracking) =>
  sets.reduce<Lift | null>((top, s) => (beats(s, top, tracking) ? s : top), null);

// A row pre-filled from the same set last time, or the last set they did, or else the
// plan's target (the bottom of the range).
function prefillRow(i: number, last: Lift[], item: DayExercise, u: Units): Row {
  const t = item.exercise.tracking;
  const prev = last[i] ?? last[last.length - 1];
  if (prev) return toRow(prev, t, u);
  return { ...toRow({ kg: 0, reps: item.repsMin, sec: item.secMin, m: 0 }, t, u), kg: '' };
}

const prefill = (count: number, last: Lift[], item: DayExercise, u: Units): Row[] =>
  Array.from({ length: count }, (_, i) => prefillRow(i, last, item, u));

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const units = useUnits();
  const { profile } = useProfile();
  const { isWide } = useContentColumn();
  const alertMode = profile?.restAlert ?? 'sound';
  // Rest from Profile > Rest timer when set, else each exercise's own rest from the plan.
  const restAfterSet = (b: Block) => profile?.restSetsSec ?? b.item.restSec;
  const restAfterExercise = (b: Block) => profile?.restExercisesSec ?? restAfterSet(b);

  const [state, setState] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [startedAt, setStartedAt] = useState(0);
  const [blocks, setBlocks] = useState<Block[]>([]);
  // Mirror of `blocks` that actions read and write synchronously, so two quick taps
  // never act on stale rows (e.g. logging the same set twice).
  const blocksRef = useRef<Block[]>([]);
  const commit = useCallback((next: Block[]) => {
    blocksRef.current = next;
    setBlocks(next);
  }, []);
  const [index, setIndex] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(0); // ms, for the rest screen's bar
  // Set while the full rest screen is up: the exercise it hands over to when rest ends.
  const [restingInto, setRestingInto] = useState<number | null>(null);
  const [newBestUntil, setNewBestUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false);
  // What the rest alert says ("Leg Press · set 3"), set with each rest.
  const restNote = useRef('');
  // True when rest ran out by itself, so its alert (maybe just delivered to a locked
  // phone) is left alone; a skip takes it back.
  const restRanOut = useRef(false);

  useEffect(() => {
    (async () => {
      const session = await getSession(db, id);
      const day = session?.splitDayId ? await getDay(db, session.splitDayId) : null;
      if (!session || !day || session.finishedAt) {
        setState('missing');
        return;
      }
      const logs = await listSetLogs(db, id);
      const counts = await getSetCounts(db, id);
      const swaps = await getSwaps(db, id);
      const order = await getSessionOrder(db, id);
      const built: Block[] = [];
      for (const planned of day.exercises) {
        // An exercise swapped earlier in this session stays swapped when it's resumed.
        const swappedId = swaps.get(planned.id);
        const swapped = swappedId ? await getExercise(db, swappedId) : null;
        const item = swapped ? { ...planned, exercise: swapped } : planned;
        const mine = logs.filter((l) => l.exerciseId === item.exercise.id);
        const last = await lastSets(db, item.exercise.id, id);
        const bestBefore = await bestLift(db, item.exercise.id, id);
        // Sets added or removed earlier in this session stay that way when it's resumed.
        const count = Math.max(1, counts.get(item.id) ?? item.sets, ...mine.map((l) => l.setIndex + 1));
        const rows: Row[] = Array.from({ length: count }, (_, i) => {
          const log = mine.find((l) => l.setIndex === i);
          return log ? toRow(log, item.exercise.tracking, units, log.id) : prefillRow(i, last, item, units);
        });
        built.push({
          item,
          planned: planned.exercise,
          rows,
          bestBefore,
          lastTop: topOf(last, item.exercise.tracking),
        });
      }
      // Exercises moved earlier in this session stay where they were put. One added to
      // the plan since goes after them, in plan order.
      if (order.size) {
        const at = new Map(built.map((b, i) => [b, order.get(b.item.id) ?? order.size + i]));
        built.sort((a, b) => at.get(a)! - at.get(b)!);
      }
      setStartedAt(session.startedAt);
      commit(built);
      const firstOpen = built.findIndex((b) => !isDone(b));
      setIndex(firstOpen === -1 ? Math.max(0, built.length - 1) : firstOpen);
      setState('ready');
    })();
    // Units are read once: the rows hold display text from here on.
  }, [db, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // One clock drives the session timer, the rest countdown and the new-best flash.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  // Ask for notification permission as the workout starts, so the first rest can reach a
  // locked phone. Asked once; Profile > Rest timer > Off skips it.
  useEffect(() => {
    if (alertMode !== 'off') prepareRestAlerts();
  }, [alertMode]);

  // Each rest schedules its alert for the moment it ends (+15 s moves it). Skipping takes
  // it back, and so does leaving the workout.
  useEffect(() => {
    if (restEndsAt !== null) scheduleRestEnd(restEndsAt, alertMode, restNote.current);
    else if (!restRanOut.current) cancelRestEnd();
    restRanOut.current = false;
  }, [restEndsAt, alertMode]);
  useEffect(
    () => () => {
      cancelRestEnd();
    },
    [],
  );

  // Rest is over: a sound and a tap if you're looking, and if the rest screen is up, on
  // to the next exercise.
  useEffect(() => {
    if (restEndsAt && now >= restEndsAt) {
      restRanOut.current = true;
      setRestEndsAt(null);
      if (now - restEndsAt < LATE_MS) playRestDone(alertMode);
      if (restingInto !== null) {
        setIndex(restingInto);
        setRestingInto(null);
      }
    }
  }, [now, restEndsAt, restingInto, alertMode]);

  // The last three seconds of a rest tick under your thumb, so you can keep your eyes
  // off the phone and still be ready.
  const restSeconds = restEndsAt !== null ? Math.ceil((restEndsAt - now) / 1000) : null;
  useEffect(() => {
    if (restSeconds !== null && restSeconds >= 1 && restSeconds <= 3 && alertMode !== 'off') haptic.select();
  }, [restSeconds, alertMode]);

  const skipRest = useCallback(() => {
    setRestEndsAt(null);
    if (restingInto !== null) {
      setIndex(restingInto);
      setRestingInto(null);
    }
  }, [restingInto]);

  const addRest = () => {
    setRestEndsAt((at) => (at ?? Date.now()) + EXTRA_REST_MS);
    setRestTotal((t) => t + EXTRA_REST_MS);
  };

  const updateRow = (bi: number, ri: number, change: Partial<Row>) =>
    commit(
      blocksRef.current.map((b, i) =>
        i === bi ? { ...b, rows: b.rows.map((r, j) => (j === ri ? { ...r, ...change } : r)) } : b,
      ),
    );

  const toggle = async (bi: number, ri: number) => {
    // Logging a set closes the keyboard and lets go of the field, so the number you just
    // typed doesn't stay highlighted.
    Keyboard.dismiss();
    if (busy.current) return;
    busy.current = true;
    try {
      const block = blocksRef.current[bi];
      const row = block.rows[ri];
      const tracking = block.item.exercise.tracking;
      if (row.logId) {
        await deleteSetLog(db, row.logId);
        updateRow(bi, ri, { logId: null });
        return;
      }
      const lift = readRow(row, tracking, units);
      if (!lift) {
        haptic.warn();
        notify('Check the numbers', MISSING[tracking]);
        return;
      }
      const logId = randomUUID();
      await saveSetLog(db, id, { id: logId, exerciseId: block.item.exercise.id, setIndex: ri, ...lift });
      haptic.press();
      updateRow(bi, ri, toRow(lift, tracking, units, logId));
      // First time on an exercise there's nothing to pre-fill from, so carry this
      // weight down to later sets that are still blank.
      if (tracking === 'weight') {
        blocksRef.current[bi].rows.forEach((r, j) => {
          if (j > ri && !r.logId && r.kg.trim() === '') updateRow(bi, j, { kg: units.show(lift.kg) });
        });
      }

      // New best: beats every earlier session and every set already done today.
      const today = block.rows
        .filter((r, j) => j !== ri && r.logId)
        .map((r) => readRow(r, tracking, units))
        .reduce<Lift | null>((top, l) => (l && beats(l, top, tracking) ? l : top), null);
      if (block.bestBefore && beats(lift, block.bestBefore, tracking) && beats(lift, today, tracking)) {
        setNewBestUntil(Date.now() + NEW_BEST_MS);
        haptic.success();
      }

      const sessionDone = blocksRef.current.every((b, i) =>
        i === bi ? b.rows.every((r, j) => j === ri || r.logId) : isDone(b),
      );
      // The exercise's last set gets the rest between exercises; any other set, the rest
      // between sets.
      const all = blocksRef.current;
      const nextSet = all[bi].rows.findIndex((r, j) => j !== ri && !r.logId);
      const exerciseDone = nextSet === -1;
      const rest = exerciseDone ? restAfterExercise(block) : restAfterSet(block);
      if (!sessionDone && rest > 0) {
        const next = all.map((_, k) => (bi + 1 + k) % all.length).find((k) => k !== bi && !isDone(all[k]));
        restNote.current = !exerciseDone
          ? `${block.item.exercise.name} · set ${nextSet + 1}`
          : next !== undefined
            ? `Up next: ${all[next].item.exercise.name}.`
            : '';
        setRestEndsAt(Date.now() + rest * 1000);
        setRestTotal(rest * 1000);
      }
    } catch {
      notify('Couldn’t save that set', 'Try ticking it again.');
    } finally {
      busy.current = false;
    }
  };

  // Editing a ticked set saves straight away; bad input goes back to what was saved.
  const commitEdit = async (bi: number, ri: number) => {
    const block = blocksRef.current[bi];
    const row = block.rows[ri];
    if (!row.logId) return;
    const tracking = block.item.exercise.tracking;
    const lift = readRow(row, tracking, units);
    const logs = await listSetLogs(db, id);
    const saved = logs.find((l) => l.id === row.logId);
    if (!lift) {
      if (saved) updateRow(bi, ri, toRow(saved, tracking, units, row.logId));
      return;
    }
    await saveSetLog(db, id, {
      id: row.logId,
      exerciseId: block.item.exercise.id,
      setIndex: ri,
      ...lift,
      doneAt: saved?.doneAt,
    });
  };

  const addSet = (bi: number) => {
    commit(
      blocksRef.current.map((b, i) => {
        if (i !== bi) return b;
        const last = b.rows[b.rows.length - 1];
        return { ...b, rows: [...b.rows, { ...last, logId: null }] };
      }),
    );
    haptic.select();
    const b = blocksRef.current[bi];
    saveSetCount(db, id, b.item.id, b.rows.length).catch(() => {});
  };

  // Any set can come out of today's session, ticked or not: 2 sets instead of the
  // planned 3, or an extra one added by mistake. The plan itself stays as it is.
  const askRemoveSet = async (bi: number, ri: number) => {
    Keyboard.dismiss();
    const block = blocksRef.current[bi];
    if (block.rows.length <= 1) {
      notify('One set stays', 'To skip this exercise, tap another one in the bar at the top.');
      return;
    }
    const row = block.rows[ri];
    const logged = row.logId ? readRow(row, block.item.exercise.tracking, units) : null;
    const ok = await confirmDestructive({
      title: `Remove set ${ri + 1}?`,
      message: logged
        ? `${formatLift(logged, block.item.exercise.tracking, units)} comes out of this session. Your plan stays as it is.`
        : 'Only for this session. Your plan stays as it is.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
    });
    if (!ok || busy.current) return;
    busy.current = true;
    try {
      // Read again: the rows may have changed while the dialog was up.
      const current = blocksRef.current[bi];
      if (ri >= current.rows.length || current.rows.length <= 1) return;
      await removeSet(
        db,
        id,
        { dayExerciseId: current.item.id, exerciseId: current.item.exercise.id },
        ri,
        current.rows.length - 1,
      );
      commit(
        blocksRef.current.map((b, i) => (i === bi ? { ...b, rows: b.rows.filter((_, j) => j !== ri) } : b)),
      );
      haptic.press();
    } catch {
      notify('Couldn’t remove that set', 'Try again.');
    } finally {
      busy.current = false;
    }
  };

  // Moves an exercise to a new place in this session's order (saved, so a resumed
  // session keeps it). The plan's order stays as it is.
  const moveBlock = (from: number, to: number) => {
    const next = [...blocksRef.current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
    saveSessionOrder(
      db,
      id,
      next.map((b) => b.item.id),
    ).catch(() => {});
  };

  // The machine is taken: do something else for this exercise today. Either another
  // exercise from this session moves up and this one comes right after it, or one from
  // the library takes its place. Only this session changes; the plan keeps the original.
  // Sets already ticked belong to the exercise they were done on, so a ticked exercise
  // can only trade places.
  const askSwap = (bi: number) => {
    Keyboard.dismiss();
    const all = blocksRef.current;
    const block = all[bi];
    const ticked = block.rows.some((r) => r.logId);
    // Later in the session first, then any skipped earlier on.
    const others = [...all.keys()]
      .map((k) => (bi + 1 + k) % all.length)
      .filter((k) => k !== bi && !isDone(all[k]));
    if (ticked && others.length === 0) {
      notify('Sets already ticked', 'Untick this exercise’s sets first, then swap it.');
      return;
    }
    openSwap({
      current: block.item.exercise,
      planned: block.planned,
      takenIds: all.filter((_, i) => i !== bi).map((b) => b.item.exercise.id),
      canReplace: !ticked,
      session: others.map((k, n) => {
        const done = all[k].rows.filter((r) => r.logId).length;
        return {
          key: all[k].item.id,
          exercise: all[k].item.exercise,
          note: done
            ? `${done} of ${all[k].rows.length} sets done`
            : k < bi
              ? 'Skipped earlier'
              : n === 0
                ? 'Up next'
                : 'Later today',
        };
      }),
      onSwitch: (key) => {
        const list = blocksRef.current;
        const from = list.findIndex((b) => b.item.id === key);
        const at = list.findIndex((b) => b.item.id === block.item.id);
        if (from === -1 || at === -1) return;
        // It goes where this one was; this one (and everything after) moves down one.
        const to = from < at ? at - 1 : at;
        moveBlock(from, to);
        setIndex(to);
        haptic.press();
      },
      onPick: async (exercise) => {
        const last = await lastSets(db, exercise.id, id);
        const bestBefore = await bestLift(db, exercise.id, id);
        // Picking the planned exercise again takes the swap back.
        await saveSwap(db, id, block.item.id, exercise.id === block.planned.id ? null : exercise.id);
        commit(
          blocksRef.current.map((b, i) =>
            i !== bi
              ? b
              : {
                  ...b,
                  item: { ...b.item, exercise },
                  rows: prefill(b.rows.length, last, { ...b.item, exercise }, units),
                  bestBefore,
                  lastTop: topOf(last, exercise.tracking),
                },
          ),
        );
        haptic.press();
      },
    });
  };

  const finish = useCallback(async () => {
    Keyboard.dismiss();
    const result = await endSession(db, id);
    if (result === 'finished') router.replace({ pathname: '/done/[id]', params: { id } });
    else router.back();
  }, [db, id]);

  const end = useCallback(async () => {
    const anyLogged = blocksRef.current.some((b) => b.rows.some((r) => r.logId));
    const ok = await confirmDestructive({
      title: 'End session?',
      message: anyLogged
        ? 'Your ticked sets are saved.'
        : 'Nothing is ticked yet, so this session won’t be kept.',
      confirmLabel: 'End',
      cancelLabel: 'Keep going',
    });
    if (ok) await finish();
  }, [finish]);

  // Android back skips the rest screen, otherwise asks before ending the session
  // (never silently leaves a session open).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state !== 'ready') return false;
      if (restingInto !== null) skipRest();
      else end();
      return true;
    });
    return () => sub.remove();
  }, [end, state, restingInto, skipRest]);

  if (state === 'missing') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={[styles.column, styles.missing]}>
          <Text style={styles.meta}>This session is over or its day was removed from your plan.</Text>
          <PrimaryButton label="Back to Today" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }
  if (state === 'loading' || !blocks.length) return <View style={styles.root} />;

  const block = blocks[index];
  const tracking = block.item.exercise.tracking;
  const fields = fieldsFor(tracking, units);
  const swapped = block.item.exercise.id !== block.planned.id;
  const active = block.rows.findIndex((r) => !r.logId);
  const blockDone = active === -1;
  const allDone = blocks.every(isDone);
  const resting = restEndsAt !== null && now < restEndsAt;
  const showNewBest = now < newBestUntil;
  const nextOpen = [...blocks.keys()]
    .map((k) => (index + 1 + k) % blocks.length)
    .find((k) => !isDone(blocks[k]));

  const cta = allDone
    ? { label: 'Finish session', onPress: finish, quiet: false }
    : blockDone
      ? {
          label: 'Next exercise',
          quiet: false,
          // Still resting: show the rest screen first; it moves on when rest ends.
          onPress: () => {
            Keyboard.dismiss();
            if (nextOpen === undefined) return;
            if (resting) setRestingInto(nextOpen);
            else setIndex(nextOpen);
          },
        }
      : { label: `Log set ${active + 1}`, onPress: () => toggle(index, active), quiet: true };

  // Priority: a new best, then the rest countdown (with "locked in." beside it once the
  // exercise is done), then "locked in." alone, then the plan's rest and last time.
  const lockedIn = <Text style={styles.statusRed}>locked in.</Text>;
  const status = showNewBest ? (
    <Animated.Text entering={FadeIn} style={styles.statusRed}>
      new best.
    </Animated.Text>
  ) : resting ? (
    <Pressable accessibilityRole="button" accessibilityLabel="Skip rest" onPress={skipRest} hitSlop={space[3]}>
      <Text style={styles.statusText}>
        {blockDone && <>{lockedIn} · </>}
        <Text style={styles.statusClock}>rest {formatClock(restEndsAt - now)}</Text> · skip
      </Text>
    </Pressable>
  ) : blockDone ? (
    <Animated.Text entering={FadeIn.duration(600)} style={styles.statusRed}>
      locked in.
    </Animated.Text>
  ) : (
    <Text style={styles.statusText}>
      rest {formatRest(restAfterSet(block))}
      {block.lastTop ? ` · last time ${formatLift(block.lastTop, tracking, units)}` : ''}
    </Text>
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.fill}>
        <View style={[styles.column, isWide && styles.columnWide]}>
          <View style={styles.header}>
            <PressableScale accessibilityRole="button" accessibilityLabel="End session" onPress={end} style={styles.close}>
              <CloseIcon />
            </PressableScale>
            <Text style={styles.label}>
              {index + 1} / {blocks.length}
            </Text>
            <Text style={styles.clock} numberOfLines={1}>
              {formatClock(now - startedAt)}
            </Text>
          </View>

          <View style={styles.progress}>
            <SlantStrip
              height={size.stripThin}
              gap={space[1]}
              bars={blocks.map((b, i) => ({
                color: isDone(b) ? colors.spotterRed : i === index ? colors.ink : colors.surfaceRaised,
              }))}
            />
            <View style={[StyleSheet.absoluteFill, styles.progressTaps]}>
              {blocks.map((b, i) => (
                <Pressable
                  key={b.item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to ${b.item.exercise.name}`}
                  onPress={() => {
                    Keyboard.dismiss();
                    if (i !== index) haptic.select();
                    setIndex(i);
                  }}
                  style={styles.progressTap}
                />
              ))}
            </View>
          </View>

          {restingInto !== null && resting ? (
            <RestScreen
              remaining={restEndsAt - now}
              total={restTotal}
              next={blocks[restingInto]}
              units={units}
              onAdd={addRest}
              onSkip={skipRest}
            />
          ) : (
            <>
              <FadeScrollView
                key={block.item.id}
                contentContainerStyle={styles.content}
                bottomOffset={FOOTER_CLEARANCE + type.caption.lineHeight + space[3]}
              >
                <Animated.View entering={rise(60)} style={styles.titleRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint="Shows form cues and your history"
                    onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: block.item.exercise.id } })}
                    style={styles.titleBlock}
                  >
                    <Text style={styles.title}>{block.item.exercise.name}</Text>
                    <TargetsLine exercise={block.item.exercise} />
                    <Text style={styles.meta}>
                      {schemeLine(block.item)}
                      {swapped ? ` · instead of ${block.planned.name}, today only` : ''}
                    </Text>
                  </Pressable>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel="Swap this exercise"
                    accessibilityHint="Do another one first, or pick a different one for this session only"
                    onPress={() => askSwap(index)}
                    style={styles.close}
                  >
                    <SwapIcon />
                  </PressableScale>
                </Animated.View>

                <Animated.View entering={rise(140)}>
                  <DemoPlayer media={block.item.exercise.media} />
                </Animated.View>

                {block.item.exercise.cues.length > 0 && (
                  <Animated.Text entering={rise(200)} style={styles.meta}>
                    {block.item.exercise.cues.join(' ')}
                  </Animated.Text>
                )}

                <Animated.View entering={rise(220)}>
                  <ExerciseNote key={block.item.exercise.id} exerciseId={block.item.exercise.id} />
                </Animated.View>

                <View style={styles.sets}>
                  <Animated.View entering={rise(240)} style={styles.gridHead}>
                    <Text style={[styles.label, styles.colSet]}>Set</Text>
                    {fields.map((f) => (
                      <Text key={f.key} style={[styles.label, styles.colNum]}>
                        {f.head}
                      </Text>
                    ))}
                    <View style={styles.colTick} />
                  </Animated.View>
                  {block.rows.map((row, ri) => (
                    <SetRow
                      key={ri}
                      index={ri}
                      row={row}
                      delay={stagger(ri, 300)}
                      isActive={ri === active}
                      fields={fields}
                      onChange={(change) => updateRow(index, ri, change)}
                      onBlur={() => commitEdit(index, ri)}
                      onToggle={() => toggle(index, ri)}
                      onRemove={() => askRemoveSet(index, ri)}
                    />
                  ))}
                  {block.item.exercise.equipment === 'barbell' && !blockDone && (
                    <PlateLine exerciseId={block.item.exercise.id} value={block.rows[active].kg} />
                  )}
                  <View style={styles.setActions}>
                    <Pressable accessibilityRole="button" onPress={() => addSet(index)} style={styles.addSet}>
                      <PlusIcon />
                      <Text style={styles.addSetLabel}>Add set</Text>
                    </Pressable>
                    {block.rows.length > 1 && (
                      <Text style={styles.removeHint} numberOfLines={2}>
                        tap a set number to remove it
                      </Text>
                    )}
                  </View>
                </View>
              </FadeScrollView>

              <PinnedFooter>
                <View style={styles.status}>{status}</View>
                <PrimaryButton label={cta.label} onPress={cta.onPress} haptic={cta.quiet ? null : 'press'} />
              </PinnedFooter>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

type RestScreenProps = {
  remaining: number;
  total: number;
  next: Block;
  units: UnitsView;
  onAdd: () => void;
  onSkip: () => void;
};

// Full-screen rest between exercises: the countdown big enough to read from the bench,
// what's next, and a way out. Moves on by itself when the time is up.
function RestScreen({ remaining, total, next, units, onAdd, onSkip }: RestScreenProps) {
  const left = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  // The clock ticks twice a second; the bar glides between ticks instead of stepping.
  const reduceMotion = useReducedMotion();
  const percent = useSharedValue(left * 100);
  useEffect(() => {
    percent.value = reduceMotion ? left * 100 : withTiming(left * 100, { duration: TICK_MS, easing: Easing.linear });
  }, [left, percent, reduceMotion]);
  const fill = useAnimatedStyle(() => ({ width: `${percent.value}%` }));
  return (
    <>
      <Animated.View entering={rise()} style={styles.rest}>
        <Text style={styles.label}>Rest</Text>
        <Text
          style={styles.restClock}
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="timer"
          accessibilityLabel={`${Math.ceil(remaining / 1000)} seconds of rest left`}
        >
          {formatClock(remaining)}
        </Text>
        <View style={styles.restTrack}>
          <Animated.View style={[styles.restFill, fill]} />
        </View>
        <View style={styles.upNext}>
          <Text style={styles.label}>Up next</Text>
          <Text style={styles.restNext}>{next.item.exercise.name}</Text>
          <TargetsLine exercise={next.item.exercise} style={styles.centered} />
          <Text style={styles.meta}>
            {schemeLine(next.item)}
            {next.lastTop ? ` · last time ${formatLift(next.lastTop, next.item.exercise.tracking, units)}` : ''}
          </Text>
        </View>
      </Animated.View>
      <PinnedFooter>
        <View style={styles.restActions}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Add 15 seconds"
            onPress={onAdd}
            haptic="select"
            style={[styles.restButton, styles.restMore]}
          >
            <Text style={styles.restMoreLabel}>+15 s</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            onPress={onSkip}
            haptic="press"
            style={[styles.restButton, styles.restSkip]}
          >
            <Text style={styles.restSkipLabel}>Skip rest</Text>
          </PressableScale>
        </View>
      </PinnedFooter>
    </>
  );
}

type SetRowProps = {
  index: number;
  row: Row;
  delay: number;
  isActive: boolean;
  fields: Field[];
  onChange: (change: Partial<Row>) => void;
  onBlur: () => void;
  onToggle: () => void;
  onRemove: () => void;
};

function SetRow({ index, row, delay, isActive, fields, onChange, onBlur, onToggle, onRemove }: SetRowProps) {
  const done = Boolean(row.logId);
  const lit = done || isActive;
  return (
    <Animated.View entering={rise(delay)} style={[styles.row, isActive && styles.rowActive]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Set ${index + 1}`}
        accessibilityHint="Removes this set from today's session"
        onPress={onRemove}
        onLongPress={onRemove}
        style={({ pressed }) => [styles.colSet, styles.setNumberTap, pressed && styles.setNumberPressed]}
      >
        <Text style={styles.setNumber}>{index + 1}</Text>
      </Pressable>
      {fields.map((f) => (
        <View key={f.key} style={[styles.cell, styles.colNum]}>
          <TextInput
            accessibilityLabel={`Set ${index + 1} ${f.head}`}
            value={row[f.key]}
            onChangeText={(text) => onChange({ [f.key]: text })}
            onBlur={onBlur}
            keyboardType={f.keyboard}
            selectTextOnFocus
            // Blank kg is bodyweight and blank distance wasn't measured; both read as 0.
            placeholder={f.key === 'kg' || f.key === 'dist' ? '0' : undefined}
            placeholderTextColor={colors.inkFaint}
            maxLength={f.maxLength}
            maxFontSizeMultiplier={1.3}
            selectionColor={colors.inkMuted}
            cursorColor={colors.ink}
            style={[styles.number, lit && styles.numberLit]}
          />
          <Text style={styles.unit}>{f.unit}</Text>
        </View>
      ))}
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? `Set ${index + 1} done, tap to undo` : `Mark set ${index + 1} done`}
        onPress={onToggle}
      >
        <Tick done={done} />
      </PressableScale>
    </Animated.View>
  );
}

// The tick box. Done, it fills with red while the check draws itself in.
function Tick({ done }: { done: boolean }) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    const to = done ? 1 : 0;
    fill.value = reduceMotion ? to : withTiming(to, { duration: motion.tickMs, easing: easeOut });
  }, [done, fill, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.value, [0, 1], [colors.surfaceRaised, colors.spotterRed]),
  }));
  return (
    <Animated.View style={[styles.tick, style]}>
      {done ? <DrawnCheck size={size.iconMd} /> : <CheckIcon size={size.iconMd} color={colors.inkFaint} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  fill: { flex: 1 },
  column: {
    flex: 1,
    width: '100%',
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[4],
    gap: space[4],
  },
  columnWide: { maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  missing: { justifyContent: 'center', gap: space[6] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: {
    width: size.tapTarget,
    height: size.tapTarget,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...type.labelWide, color: colors.inkMuted },
  clock: { ...type.numeralCaption, color: colors.inkMuted, minWidth: size.tapTarget, textAlign: 'right' },
  progress: { minHeight: size.tapTarget, justifyContent: 'center' },
  progressTaps: { flexDirection: 'row' },
  progressTap: { flex: 1 },
  content: { gap: space[4] },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  titleBlock: { flex: 1, gap: space[1] },
  title: { ...type.title, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  sets: { gap: space[2] },
  gridHead: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[3] },
  colSet: { width: size.dayColumn },
  // minWidth 0 lets inputs shrink inside the row (web inputs keep a wide intrinsic size).
  colNum: { flex: 1, minWidth: 0 },
  colTick: { width: size.tapTarget },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: size.ring,
    borderColor: 'transparent',
  },
  rowActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.spotterRed },
  setNumber: { ...type.numeralCaption, color: colors.inkMuted },
  // Each number carries its unit, so a row reads on its own when the column titles
  // have scrolled away while typing.
  cell: { flexDirection: 'row', alignItems: 'baseline', gap: space[1] },
  unit: { ...type.caption, color: colors.inkMuted },
  number: {
    flexShrink: 1,
    minWidth: size.tapTarget,
    ...type.numeralM,
    color: colors.inkMuted,
    minHeight: size.tapTarget,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  numberLit: { color: colors.ink },
  tick: {
    width: size.tapTarget,
    height: size.tapTarget,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberTap: { alignSelf: 'stretch', minHeight: size.tapTarget, justifyContent: 'center' },
  setNumberPressed: { opacity: 0.5 },
  setActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: size.tapTarget },
  removeHint: { ...type.caption, color: colors.inkMuted, flexShrink: 1, textAlign: 'right' },
  addSetLabel: { ...type.bodyStrong, color: colors.inkMuted },
  status: { minHeight: type.caption.lineHeight, alignItems: 'center' },
  statusText: { ...type.caption, color: colors.inkMuted, textAlign: 'center' },
  statusClock: { ...type.numeralCaption, color: colors.ink },
  statusRed: { ...type.numeralCaption, color: colors.redText },
  rest: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space[4] },
  restClock: { ...type.numeralHero, color: colors.ink },
  restTrack: {
    alignSelf: 'stretch',
    height: size.stripThin,
    borderRadius: size.stripThin / 2,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  restFill: { height: '100%', backgroundColor: colors.ink },
  upNext: { alignItems: 'center', gap: space[1], marginTop: space[6] },
  restNext: { ...type.title, color: colors.ink, textAlign: 'center' },
  centered: { textAlign: 'center' },
  restActions: { flexDirection: 'row', gap: space[2] },
  restButton: {
    height: size.buttonPrimary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  restMore: { flex: 1, backgroundColor: colors.surface },
  restSkip: { flex: 2, backgroundColor: colors.spotterRed },
  restMoreLabel: { ...type.button, color: colors.ink },
  restSkipLabel: { ...type.button, color: colors.onRed },
});
