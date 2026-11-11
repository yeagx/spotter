import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { OutlineButton, PrimaryButton } from '@/components/Buttons';
import { ExpandChevron } from '@/components/ExpandChevron';
import { FadeScrollView } from '@/components/FadeScrollView';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/Icons';
import { PressableScale } from '@/components/PressableScale';
import { StackScreen } from '@/components/StackScreen';
import { TextField } from '@/components/TextField';
import { DEFAULT_SCHEME, getDay, saveDay, type DayExercise, type SplitDay } from '@/db/plan';
import type { Exercise } from '@/db/types';
import { openLibrary } from '@/lib/libraryPicker';
import { rise, settle, stagger } from '@/lib/motion';
import {
  SETS_MAX,
  SETS_MIN,
  formatReps,
  formatRest,
  parseReps,
  parseRest,
} from '@/lib/scheme';
import { weekdayName } from '@/lib/week';
import { useProfile } from '@/state/profile';
import { colors, radius, size, space, type } from '@/theme';

// One exercise in the draft. Reps and rest keep the raw text being typed; it's parsed
// on blur and again on save, and falls back to the last good value if it doesn't parse.
type Item = DayExercise & { repsText: string; restText: string };

const toItem = (e: DayExercise): Item => ({
  ...e,
  repsText: formatReps(e.repsMin, e.repsMax),
  restText: formatRest(e.restSec),
});

const newItem = (exercise: Exercise): Item =>
  toItem({ id: randomUUID(), exercise, ...DEFAULT_SCHEME });

// Settles an item's typed text into numbers, or reverts the text if it doesn't parse.
function commit(item: Item): Item {
  const reps = parseReps(item.repsText) ?? { min: item.repsMin, max: item.repsMax };
  const rest = parseRest(item.restText) ?? item.restSec;
  return {
    ...item,
    repsMin: reps.min,
    repsMax: reps.max,
    restSec: rest,
    repsText: formatReps(reps.min, reps.max),
    restText: formatRest(rest),
  };
}

// Reps like "8–12" and rest like "1:30" need punctuation, so not the number pad.
const SCHEME_KEYBOARD = Platform.select({
  ios: 'numbers-and-punctuation',
  default: 'default',
} as const);

// Name a day and set each exercise's sets, reps and rest. A draft until Save.
export default function EditDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [day, setDay] = useState<SplitDay | null>();
  const [name, setName] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  // A rest set for every exercise in Profile replaces the rests below; say so.
  const restOverride = useProfile().profile?.restSetsSec ?? null;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDay(db, id).then((d) => {
      setDay(d);
      if (!d) return;
      setName(d.name);
      setItems(d.exercises.map(toItem));
      setOpenId(d.exercises[0]?.id ?? null);
    });
  }, [db, id]);

  const dayLabel = day?.weekday ? weekdayName(day.weekday) : 'Day';

  const update = (itemId: string, change: (item: Item) => Item) =>
    setItems((list) => list.map((it) => (it.id === itemId ? change(it) : it)));

  const move = (index: number, by: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });

  const remove = (itemId: string) => {
    setItems((list) => list.filter((it) => it.id !== itemId));
    setOpenId(null);
  };

  const addExercises = () =>
    openLibrary({
      dayLabel,
      existingIds: items.map((it) => it.exercise.id),
      onAdd: (exercises) => setItems((list) => [...list, ...exercises.map(newItem)]),
    });

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveDay(db, id, {
        name: name.trim(),
        exercises: items.map(commit).map((it) => ({
          id: it.id,
          exerciseId: it.exercise.id,
          sets: it.sets,
          repsMin: it.repsMin,
          repsMax: it.repsMax,
          restSec: it.restSec,
        })),
      });
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <StackScreen
      label={dayLabel}
      footer={<PrimaryButton label="Save day" onPress={save} disabled={!day || busy} />}
    >
      {day === null && <Text style={styles.meta}>This day is no longer in your split.</Text>}
      {day && (
        <FadeScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={rise(80)}>
            <TextField
              label="Day name"
              value={name}
              onChangeText={setName}
              placeholder="New day"
              returnKeyType="done"
              maxLength={40}
            />
          </Animated.View>

          <View style={styles.list}>
            <Animated.View entering={rise(140)} style={styles.listHead}>
              <Text style={styles.label}>Exercises</Text>
              {items.length > 0 && <Text style={styles.meta}>tap to set sets & reps</Text>}
            </Animated.View>

            {items.length > 0 && restOverride !== null && (
              <Animated.Text entering={rise(160)} style={styles.meta}>
                Rest timer in Profile is set to {formatRest(restOverride)} between sets, so it's used instead
                of the rests here.
              </Animated.Text>
            )}

            {items.length === 0 && (
              <Animated.Text entering={rise(180)} style={styles.meta}>
                No exercises yet.
              </Animated.Text>
            )}

            {items.map((item, i) => (
              <ExerciseCard
                key={item.id}
                item={item}
                delay={stagger(i, 180)}
                open={openId === item.id}
                isFirst={i === 0}
                isLast={i === items.length - 1}
                onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                onChange={(change) => update(item.id, change)}
                onMove={(by) => move(i, by)}
                onRemove={() => remove(item.id)}
              />
            ))}

            <Animated.View entering={rise(stagger(items.length, 220))} layout={settle}>
              <OutlineButton label="Add exercise" onPress={addExercises} />
            </Animated.View>
          </View>
        </FadeScrollView>
      )}
    </StackScreen>
  );
}

type CardProps = {
  item: Item;
  delay: number;
  open: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onChange: (change: (item: Item) => Item) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
};

function ExerciseCard({
  item,
  delay,
  open,
  isFirst,
  isLast,
  onToggle,
  onChange,
  onMove,
  onRemove,
}: CardProps) {
  // The summary follows what's typed, as long as it parses.
  const reps = parseReps(item.repsText) ?? { min: item.repsMin, max: item.repsMax };
  const setSets = (by: number) =>
    onChange((it) => ({ ...it, sets: Math.max(SETS_MIN, Math.min(SETS_MAX, it.sets + by)) }));

  return (
    <Animated.View
      entering={rise(delay)}
      layout={settle}
      style={[styles.card, open && styles.cardOpen]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={styles.cardHead}
      >
        <View style={styles.cardText}>
          <Text style={styles.cardName}>{item.exercise.name}</Text>
          <Text style={styles.meta}>
            {item.sets} sets · {formatReps(reps.min, reps.max)} reps
          </Text>
        </View>
        <ExpandChevron open={open} />
      </Pressable>

      {open && (
        <Animated.View entering={rise()} style={styles.panel}>
          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={styles.label}>Sets</Text>
              <View style={styles.stepper}>
                <StepButton label="−" a11y="Fewer sets" onPress={() => setSets(-1)} disabled={item.sets <= SETS_MIN} />
                <Text style={styles.stepValue} numberOfLines={1} adjustsFontSizeToFit>
                  {item.sets}
                </Text>
                <StepButton label="+" a11y="More sets" onPress={() => setSets(1)} disabled={item.sets >= SETS_MAX} />
              </View>
            </View>
            <SchemeInput
              label="Reps"
              value={item.repsText}
              onChangeText={(repsText) => onChange((it) => ({ ...it, repsText }))}
              onBlur={() => onChange(commit)}
            />
            <SchemeInput
              label="Rest"
              value={item.restText}
              onChangeText={(restText) => onChange((it) => ({ ...it, restText }))}
              onBlur={() => onChange(commit)}
            />
          </View>

          <View style={styles.panelFoot}>
            <View style={styles.moves}>
              <IconButton a11y="Move up" onPress={() => onMove(-1)} disabled={isFirst}>
                <ChevronUpIcon color={isFirst ? colors.inkFaint : colors.inkMuted} />
              </IconButton>
              <IconButton a11y="Move down" onPress={() => onMove(1)} disabled={isLast}>
                <ChevronDownIcon color={isLast ? colors.inkFaint : colors.inkMuted} />
              </IconButton>
            </View>
            <View style={styles.moves}>
              {item.exercise.media && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/exercise/[id]', params: { id: item.exercise.id } })
                  }
                  style={styles.remove}
                >
                  <Text style={styles.demoLabel}>View demo</Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" onPress={onRemove} style={styles.remove}>
                <Text style={styles.removeLabel}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function SchemeInput({
  label,
  value,
  onChangeText,
  onBlur,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType={SCHEME_KEYBOARD}
        selectTextOnFocus
        returnKeyType="done"
        maxLength={7}
        selectionColor={colors.inkMuted}
        cursorColor={colors.ink}
        style={styles.input}
      />
    </View>
  );
}

function StepButton({
  label,
  a11y,
  onPress,
  disabled,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      haptic="select"
      hitSlop={STEP_SLOP}
      style={styles.step}
    >
      <Text style={[styles.stepLabel, disabled && styles.stepLabelDisabled]}>{label}</Text>
    </PressableScale>
  );
}

function IconButton({
  a11y,
  onPress,
  disabled,
  children,
}: {
  a11y: string;
  onPress: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.iconButton}
    >
      {children}
    </Pressable>
  );
}

// Stepper buttons are narrow so three fields fit a 360px phone; the slop keeps the
// touch area at 44px wide.
const STEP_SLOP = { left: (size.tapTarget - size.stepper) / 2, right: (size.tapTarget - size.stepper) / 2 };

const styles = StyleSheet.create({
  content: { gap: space[6], paddingTop: space[2] },
  list: { gap: space[2] },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2] },
  label: { ...type.labelWide, color: colors.inkMuted },
  meta: { ...type.caption, color: colors.inkMuted },
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: size.ring,
    borderColor: 'transparent',
  },
  cardOpen: { borderColor: colors.hairline },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: size.tapTarget,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  cardText: { flex: 1 },
  cardName: { ...type.bodyStrong, color: colors.ink },
  panel: { gap: space[3], paddingHorizontal: space[4], paddingBottom: space[4] },
  fields: { flexDirection: 'row', gap: space[2] },
  field: { flex: 1, minWidth: 0, gap: space[2] },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[1],
  },
  step: {
    width: size.stepper,
    height: size.tapTarget,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: { ...type.heading, color: colors.ink },
  stepLabelDisabled: { color: colors.inkFaint },
  stepValue: { ...type.numeralS, color: colors.ink, flexShrink: 1, textAlign: 'center' },
  input: {
    ...type.numeralXs,
    minHeight: size.tapTarget,
    paddingHorizontal: space[1],
    paddingVertical: space[2],
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.ink,
    textAlign: 'center',
  },
  panelFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moves: { flexDirection: 'row' },
  iconButton: {
    width: size.tapTarget,
    height: size.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    minHeight: size.tapTarget,
    paddingHorizontal: space[3],
    justifyContent: 'center',
  },
  removeLabel: { ...type.captionStrong, color: colors.redText },
  demoLabel: { ...type.captionStrong, color: colors.ink },
});
