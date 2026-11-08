import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PrimaryButton, SmallButton } from '@/components/Buttons';
import { Chip } from '@/components/Chip';
import { EdgeFade } from '@/components/EdgeFade';
import { ExerciseThumb } from '@/components/ExerciseThumb';
import { FadeScrollView } from '@/components/FadeScrollView';
import { CheckIcon, SearchIcon } from '@/components/Icons';
import { StackScreen } from '@/components/StackScreen';
import { TargetsLine } from '@/components/TargetsLine';
import { TextField } from '@/components/TextField';
import { createCustomExercise, listExercises } from '@/db/exercises';
import { MUSCLES, type Exercise, type Muscle } from '@/db/types';
import { equipmentLabel, muscleLabel, searchText } from '@/lib/labels';
import { currentLibraryRequest } from '@/lib/libraryPicker';
import { rise, settle } from '@/lib/motion';
import { colors, radius, size, space, type } from '@/theme';

// Search ignores case, spaces and dashes, so "pullup" finds "Pull-Up".
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Grouped by muscle in filter order, then by name, so "All" reads like a catalogue.
const byMuscleThenName = (a: Exercise, b: Exercise) =>
  MUSCLES.indexOf(a.muscle) - MUSCLES.indexOf(b.muscle) || a.name.localeCompare(b.name);

// Pick several exercises at once. What "Add" does belongs to whoever opened it.
export default function LibraryScreen() {
  const db = useSQLiteContext();
  const [request] = useState(currentLibraryRequest);
  const [all, setAll] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [picked, setPicked] = useState<string[]>([]); // in tap order, which is add order
  const [busy, setBusy] = useState(false);
  const adding = useRef(false); // a double tap must never add the picks twice
  // Rows rise in on first paint only, not on every keystroke or filter change.
  const firstPaint = useRef(true);

  useEffect(() => {
    if (!request) router.back();
  }, [request]);

  useEffect(() => {
    listExercises(db).then((list) => setAll(list.sort(byMuscleThenName)));
  }, [db]);

  useEffect(() => {
    if (all.length) firstPaint.current = false;
  }, [all]);

  const shown = useMemo(() => {
    const q = normalize(query);
    // Search covers what an exercise works too, so "quads" finds Leg Extension.
    return all.filter((e) => (!muscle || e.muscle === muscle) && normalize(searchText(e)).includes(q));
  }, [all, query, muscle]);

  if (!request) return null;
  const existing = new Set(request.existingIds);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const onCreated = (exercise: Exercise) => {
    setAll((list) => [...list, exercise].sort(byMuscleThenName));
    setPicked((p) => [...p, exercise.id]);
    setQuery('');
    setMuscle(exercise.muscle);
  };

  const add = async () => {
    if (adding.current) return;
    adding.current = true;
    setBusy(true);
    try {
      const byId = new Map(all.map((e) => [e.id, e]));
      await request.onAdd(picked.map((id) => byId.get(id)!));
      router.back();
    } catch {
      adding.current = false;
      setBusy(false);
    }
  };

  const n = picked.length;

  return (
    <StackScreen
      label={`Add to ${request.dayLabel}`}
      footer={
        <PrimaryButton
          label={n === 0 ? 'Select exercises' : `Add ${n} to ${request.dayLabel}`}
          onPress={add}
          disabled={n === 0 || busy}
        />
      }
    >
      <View style={styles.body}>
        <Animated.View entering={rise(60)} style={styles.search}>
          <SearchIcon />
          <TextInput
            accessibilityLabel="Search exercises"
            placeholder="Search exercises"
            placeholderTextColor={colors.inkMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={colors.inkMuted}
            cursorColor={colors.ink}
            style={styles.searchInput}
          />
        </Animated.View>

        <Animated.View entering={rise(120)} style={styles.chipsBleed}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Chip label="All" selected={muscle === null} onPress={() => setMuscle(null)} />
            {MUSCLES.map((m) => (
              <Chip key={m} label={muscleLabel(m)} selected={muscle === m} onPress={() => setMuscle(m)} />
            ))}
          </ScrollView>
          <EdgeFade edge="right" />
        </Animated.View>

        <FadeScrollView>
          {shown.map((e, i) => {
            const already = existing.has(e.id);
            const on = picked.includes(e.id);
            return (
              <Animated.View
                key={e.id}
                entering={firstPaint.current ? rise(160 + Math.min(i, 10) * 40) : undefined}
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: already }}
                  disabled={already}
                  onPress={() => toggle(e.id)}
                  style={styles.row}
                >
                  <ExerciseThumb media={e.media} />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowName, already && styles.muted]}>{e.name}</Text>
                    <TargetsLine exercise={e} />
                    <Text style={styles.meta}>
                      {already ? `Already in ${request.dayLabel}` : equipmentLabel(e)}
                    </Text>
                  </View>
                  <View style={[styles.box, on && styles.boxOn]}>
                    {on && (
                      <Animated.View entering={FadeIn.duration(260)}>
                        <CheckIcon />
                      </Animated.View>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}

          {all.length > 0 && shown.length === 0 && (
            <Text style={[styles.meta, styles.empty]}>Nothing matches “{query.trim()}”.</Text>
          )}

          <CustomExercise
            initialName={query.trim()}
            initialMuscle={muscle}
            onCreate={(name, m) => createCustomExercise(db, { name, muscle: m }).then(onCreated)}
          />
        </FadeScrollView>
      </View>
    </StackScreen>
  );
}

// "Can't find it?" opens a small form: a name and one muscle. No demo, no equipment.
function CustomExercise({
  initialName,
  initialMuscle,
  onCreate,
}: {
  initialName: string;
  initialMuscle: Muscle | null;
  onCreate: (name: string, muscle: Muscle) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [busy, setBusy] = useState(false);

  // Starts from what was searched and filtered, which is usually what's missing.
  const start = () => {
    setName(initialName);
    setMuscle(initialMuscle);
    setOpen(true);
  };

  if (!open) {
    return (
      <Pressable accessibilityRole="button" onPress={start} style={styles.customLink}>
        <Text style={styles.rowName}>Can't find it? Create a custom exercise</Text>
        <Text style={styles.meta}>Custom exercises have no demo.</Text>
      </Pressable>
    );
  }

  const ready = name.trim().length > 0 && muscle !== null && !busy;
  const create = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await onCreate(name, muscle);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Animated.View entering={rise()} layout={settle} style={styles.customCard}>
      <TextField
        label="Exercise name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Landmine Press"
        autoFocus
        maxLength={40}
      />
      <Text style={styles.label}>Muscle</Text>
      <View style={styles.muscleGrid}>
        {MUSCLES.map((m) => (
          <Chip
            key={m}
            label={muscleLabel(m)}
            selected={muscle === m}
            onPress={() => setMuscle(m)}
            raised
          />
        ))}
      </View>
      <View style={styles.customActions}>
        <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.cancel}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
        <SmallButton label="Create" onPress={create} disabled={!ready} raised />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: space[4] },
  label: { ...type.labelWide, color: colors.inkMuted },
  meta: { ...type.caption, color: colors.inkMuted },
  muted: { color: colors.inkMuted },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: size.buttonPrimary,
    paddingHorizontal: space[4],
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  searchInput: { ...type.body, flex: 1, minWidth: 0, color: colors.ink, paddingVertical: space[2] },
  // Chips bleed to the right screen edge and fade out there, hinting at more.
  chipsBleed: { marginRight: -space[4] },
  chips: { gap: space[2], paddingRight: space[4], paddingVertical: space[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
    borderBottomWidth: size.divider,
    borderBottomColor: colors.hairline,
  },
  rowText: { flex: 1 },
  rowName: { ...type.bodyStrong, color: colors.ink },
  box: {
    width: size.check,
    height: size.check,
    borderRadius: radius.sm,
    borderWidth: size.ring,
    borderColor: colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.spotterRed, borderColor: colors.spotterRed },
  empty: { paddingVertical: space[4] },
  customLink: { paddingVertical: space[4] },
  customCard: {
    marginTop: space[4],
    padding: space[4],
    gap: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  customActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: space[2],
  },
  cancel: { minHeight: size.tapTarget, paddingHorizontal: space[3], justifyContent: 'center' },
  cancelLabel: { ...type.bodyStrong, color: colors.inkMuted },
});
