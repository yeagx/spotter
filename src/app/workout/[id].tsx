import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/Buttons';
import { DemoPlayer } from '@/components/DemoPlayer';
import { FOOTER_CLEARANCE, FadeScrollView } from '@/components/FadeScrollView';
import { CheckIcon, CloseIcon, PlusIcon } from '@/components/Icons';
import { PinnedFooter } from '@/components/PinnedFooter';
import { PressableScale } from '@/components/PressableScale';
import { SlantStrip } from '@/components/Slant';
import { getDay, type DayExercise } from '@/db/plan';
import {
  beats,
  bestLift,
  deleteSetLog,
  endSession,
  getSession,
  lastSets,
  listSetLogs,
  saveSetLog,
  type Lift,
} from '@/db/sessions';
import { confirmDestructive, notify } from '@/lib/confirm';
import { formatClock } from '@/lib/dates';
import { rise, stagger } from '@/lib/motion';
import { formatReps, formatRest } from '@/lib/scheme';
import { parseDecimal, parseWhole } from '@/lib/units';
import { useContentColumn } from '@/hooks/useContentColumn';
import { useUnits } from '@/state/profile';
import { colors, layout, radius, size, space, type } from '@/theme';

// One set row. kg and reps hold what's on screen (in the user's units) so typing is
// free; `logId` is set once the set is ticked and saved.
type Row = { kg: string; reps: string; logId: string | null };

type Block = {
  item: DayExercise;
  rows: Row[];
  bestBefore: Lift | null; // best from earlier sessions, for "new best."
  lastTop: Lift | null; // top set last time, for "last time 20 kg × 10"
};

const NEW_BEST_MS = 4000;
const EXTRA_REST_MS = 15000;
const TICK_MS = 500;

const isDone = (b: Block) => b.rows.every((r) => r.logId);

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const units = useUnits();
  const { isWide } = useContentColumn();

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

  useEffect(() => {
    (async () => {
      const session = await getSession(db, id);
      const day = session?.splitDayId ? await getDay(db, session.splitDayId) : null;
      if (!session || !day || session.finishedAt) {
        setState('missing');
        return;
      }
      const logs = await listSetLogs(db, id);
      const built: Block[] = [];
      for (const item of day.exercises) {
        const mine = logs.filter((l) => l.exerciseId === item.exercise.id);
        const last = await lastSets(db, item.exercise.id, id);
        const bestBefore = await bestLift(db, item.exercise.id, id);
        const count = Math.max(item.sets, ...mine.map((l) => l.setIndex + 1));
        const rows: Row[] = Array.from({ length: count }, (_, i) => {
          const log = mine.find((l) => l.setIndex === i);
          if (log) return { kg: units.show(log.kg), reps: String(log.reps), logId: log.id };
          // Pre-fill from the same set last time, or the last set they did.
          const prev = last[i] ?? last[last.length - 1];
          return {
            kg: prev ? units.show(prev.kg) : '',
            reps: String(prev?.reps ?? item.repsMin),
            logId: null,
          };
        });
        const lastTop = last.reduce<Lift | null>((top, s) => (beats(s, top) ? s : top), null);
        built.push({ item, rows, bestBefore, lastTop });
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

  // Rest is over: a tap on the wrist, and if the rest screen is up, on to the next exercise.
  useEffect(() => {
    if (restEndsAt && now >= restEndsAt) {
      setRestEndsAt(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (restingInto !== null) {
        setIndex(restingInto);
        setRestingInto(null);
      }
    }
  }, [now, restEndsAt, restingInto]);

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

  // Reads a row's typed numbers. Empty kg means bodyweight (0).
  const readRow = (row: Row): Lift | null => {
    const value = row.kg.trim() === '' ? 0 : parseDecimal(row.kg);
    const reps = parseWhole(row.reps);
    if (value === null || !reps) return null;
    return { kg: units.toKg(value), reps };
  };

  const toggle = async (bi: number, ri: number) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const block = blocksRef.current[bi];
      const row = block.rows[ri];
      if (row.logId) {
        await deleteSetLog(db, row.logId);
        updateRow(bi, ri, { logId: null });
        return;
      }
      const lift = readRow(row);
      if (!lift) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        notify('Check the numbers', 'Enter the weight and reps for this set.');
        return;
      }
      const logId = randomUUID();
      await saveSetLog(db, id, { id: logId, exerciseId: block.item.exercise.id, setIndex: ri, ...lift });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateRow(bi, ri, { logId, kg: units.show(lift.kg), reps: String(lift.reps) });
      // First time on an exercise there's nothing to pre-fill from, so carry this
      // weight down to later sets that are still blank.
      blocksRef.current[bi].rows.forEach((r, j) => {
        if (j > ri && !r.logId && r.kg.trim() === '') updateRow(bi, j, { kg: units.show(lift.kg) });
      });

      // New best: beats every earlier session and every set already done today.
      const today = block.rows
        .filter((r, j) => j !== ri && r.logId)
        .map(readRow)
        .reduce<Lift | null>((top, l) => (l && beats(l, top) ? l : top), null);
      if (block.bestBefore && beats(lift, block.bestBefore) && beats(lift, today)) {
        setNewBestUntil(Date.now() + NEW_BEST_MS);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      const sessionDone = blocksRef.current.every((b, i) =>
        i === bi ? b.rows.every((r, j) => j === ri || r.logId) : isDone(b),
      );
      if (!sessionDone && block.item.restSec > 0) {
        setRestEndsAt(Date.now() + block.item.restSec * 1000);
        setRestTotal(block.item.restSec * 1000);
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
    const lift = readRow(row);
    const logs = await listSetLogs(db, id);
    const saved = logs.find((l) => l.id === row.logId);
    if (!lift) {
      if (saved) updateRow(bi, ri, { kg: units.show(saved.kg), reps: String(saved.reps) });
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

  const addSet = (bi: number) =>
    commit(
      blocksRef.current.map((b, i) => {
        if (i !== bi) return b;
        const last = b.rows[b.rows.length - 1];
        return { ...b, rows: [...b.rows, { kg: last?.kg ?? '', reps: last?.reps ?? '', logId: null }] };
      }),
    );

  const finish = useCallback(async () => {
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
  const active = block.rows.findIndex((r) => !r.logId);
  const blockDone = active === -1;
  const allDone = blocks.every(isDone);
  const resting = restEndsAt !== null && now < restEndsAt;
  const showNewBest = now < newBestUntil;
  const nextOpen = [...blocks.keys()]
    .map((k) => (index + 1 + k) % blocks.length)
    .find((k) => !isDone(blocks[k]));

  const cta = allDone
    ? { label: 'Finish session', onPress: finish }
    : blockDone
      ? {
          label: 'Next exercise',
          // Still resting: show the rest screen first; it moves on when rest ends.
          onPress: () => {
            if (nextOpen === undefined) return;
            if (resting) setRestingInto(nextOpen);
            else setIndex(nextOpen);
          },
        }
      : { label: `Log set ${active + 1}`, onPress: () => toggle(index, active) };

  // Priority: a new best, then the rest countdown (with "locked in." beside it once the
  // exercise is done), then "locked in." alone, then the plan's rest and last time.
  const lockedIn = <Text style={styles.statusRed}>locked in.</Text>;
  const status = showNewBest ? (
    <Animated.Text entering={FadeIn} style={styles.statusRed}>
      new best.
    </Animated.Text>
  ) : resting ? (
    <Pressable accessibilityRole="button" accessibilityLabel="Skip rest" onPress={() => setRestEndsAt(null)} hitSlop={space[3]}>
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
      rest {formatRest(block.item.restSec)}
      {block.lastTop
        ? ` · last time ${units.show(block.lastTop.kg)} ${units.units} × ${block.lastTop.reps}`
        : ''}
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
                  onPress={() => setIndex(i)}
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
              unitLabel={units.units}
              show={units.show}
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
                <Animated.View entering={rise(60)}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint="Shows form cues and your history"
                    onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: block.item.exercise.id } })}
                    style={styles.titleBlock}
                  >
                    <Text style={styles.title}>{block.item.exercise.name}</Text>
                    <Text style={styles.meta}>
                      {block.item.sets} sets · {formatReps(block.item.repsMin, block.item.repsMax)} reps
                    </Text>
                  </Pressable>
                </Animated.View>

                <Animated.View entering={rise(140)}>
                  <DemoPlayer media={block.item.exercise.media} />
                </Animated.View>

                {block.item.exercise.cues.length > 0 && (
                  <Animated.Text entering={rise(200)} style={styles.meta}>
                    {block.item.exercise.cues.join(' ')}
                  </Animated.Text>
                )}

                <View style={styles.sets}>
                  <Animated.View entering={rise(240)} style={styles.gridHead}>
                    <Text style={[styles.label, styles.colSet]}>Set</Text>
                    <Text style={[styles.label, styles.colNum]}>{units.units}</Text>
                    <Text style={[styles.label, styles.colNum]}>Reps</Text>
                    <View style={styles.colTick} />
                  </Animated.View>
                  {block.rows.map((row, ri) => (
                    <SetRow
                      key={ri}
                      index={ri}
                      row={row}
                      delay={stagger(ri, 300)}
                      isActive={ri === active}
                      unitLabel={units.units}
                      onChange={(change) => updateRow(index, ri, change)}
                      onBlur={() => commitEdit(index, ri)}
                      onToggle={() => toggle(index, ri)}
                    />
                  ))}
                  <Pressable accessibilityRole="button" onPress={() => addSet(index)} style={styles.addSet}>
                    <PlusIcon />
                    <Text style={styles.addSetLabel}>Add set</Text>
                  </Pressable>
                </View>
              </FadeScrollView>

              <PinnedFooter>
                <View style={styles.status}>{status}</View>
                <PrimaryButton label={cta.label} onPress={cta.onPress} />
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
  unitLabel: string;
  show: (kg: number) => string;
  onAdd: () => void;
  onSkip: () => void;
};

// Full-screen rest between exercises: the countdown big enough to read from the bench,
// what's next, and a way out. Moves on by itself when the time is up.
function RestScreen({ remaining, total, next, unitLabel, show, onAdd, onSkip }: RestScreenProps) {
  const left = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
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
          <View style={[styles.restFill, { width: `${left * 100}%` }]} />
        </View>
        <View style={styles.upNext}>
          <Text style={styles.label}>Up next</Text>
          <Text style={styles.restNext}>{next.item.exercise.name}</Text>
          <Text style={styles.meta}>
            {next.item.sets} sets · {formatReps(next.item.repsMin, next.item.repsMax)} reps
            {next.lastTop ? ` · last time ${show(next.lastTop.kg)} ${unitLabel} × ${next.lastTop.reps}` : ''}
          </Text>
        </View>
      </Animated.View>
      <PinnedFooter>
        <View style={styles.restActions}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Add 15 seconds"
            onPress={onAdd}
            style={[styles.restButton, styles.restMore]}
          >
            <Text style={styles.restMoreLabel}>+15 s</Text>
          </PressableScale>
          <PressableScale accessibilityRole="button" onPress={onSkip} style={[styles.restButton, styles.restSkip]}>
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
  unitLabel: string;
  onChange: (change: Partial<Row>) => void;
  onBlur: () => void;
  onToggle: () => void;
};

function SetRow({ index, row, delay, isActive, unitLabel, onChange, onBlur, onToggle }: SetRowProps) {
  const done = Boolean(row.logId);
  const lit = done || isActive;
  return (
    <Animated.View entering={rise(delay)} style={[styles.row, isActive && styles.rowActive]}>
      <Text style={[styles.setNumber, styles.colSet]}>{index + 1}</Text>
      <View style={[styles.cell, styles.colNum]}>
        <TextInput
          accessibilityLabel={`Set ${index + 1} ${unitLabel}`}
          value={row.kg}
          onChangeText={(kg) => onChange({ kg })}
          onBlur={onBlur}
          keyboardType="decimal-pad"
          selectTextOnFocus
          placeholder="0"
          placeholderTextColor={colors.inkFaint}
          maxLength={6}
          maxFontSizeMultiplier={1.3}
          selectionColor={colors.inkMuted}
          cursorColor={colors.ink}
          style={[styles.number, lit && styles.numberLit]}
        />
        <Text style={styles.unit}>{unitLabel}</Text>
      </View>
      <View style={[styles.cell, styles.colNum]}>
        <TextInput
          accessibilityLabel={`Set ${index + 1} reps`}
          value={row.reps}
          onChangeText={(reps) => onChange({ reps })}
          onBlur={onBlur}
          keyboardType="number-pad"
          selectTextOnFocus
          maxLength={3}
          maxFontSizeMultiplier={1.3}
          selectionColor={colors.inkMuted}
          cursorColor={colors.ink}
          style={[styles.number, lit && styles.numberLit]}
        />
        <Text style={styles.unit}>reps</Text>
      </View>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? `Set ${index + 1} done, tap to undo` : `Mark set ${index + 1} done`}
        onPress={onToggle}
        style={[styles.tick, done && styles.tickDone]}
      >
        {done ? (
          <Animated.View entering={FadeIn.duration(260)}>
            <CheckIcon size={size.iconMd} />
          </Animated.View>
        ) : (
          <CheckIcon size={size.iconMd} color={colors.inkFaint} />
        )}
      </PressableScale>
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
  titleBlock: { gap: space[1] },
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
  tickDone: { backgroundColor: colors.spotterRed },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: size.tapTarget },
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
