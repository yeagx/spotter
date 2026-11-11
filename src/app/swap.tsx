import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Chip } from '@/components/Chip';
import { ExerciseThumb } from '@/components/ExerciseThumb';
import { FadeScrollView } from '@/components/FadeScrollView';
import { SearchIcon } from '@/components/Icons';
import { StackScreen } from '@/components/StackScreen';
import { TargetsLine } from '@/components/TargetsLine';
import { listExercises } from '@/db/exercises';
import type { Exercise } from '@/db/types';
import { equipmentLabel, muscleLabel, searchText } from '@/lib/labels';
import { rise } from '@/lib/motion';
import { currentSwapRequest } from '@/lib/swapPicker';
import { colors, radius, size, space, type } from '@/theme';

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// How much an exercise overlaps with the one being replaced: the same main muscle
// first, then anything that shares a muscle at all.
function closeness(e: Exercise, to: Exercise) {
  const mine = e.targets?.primary ?? [];
  const theirs = to.targets?.primary ?? [];
  if (mine.some((m) => theirs.includes(m))) return 0;
  const all = [...mine, ...(e.targets?.secondary ?? [])];
  return all.some((m) => theirs.includes(m)) ? 1 : 2;
}

// The machine is taken: pick something else for today. One tap swaps it in and goes
// back; the plan itself is never touched.
export default function SwapScreen() {
  const db = useSQLiteContext();
  const [request] = useState(currentSwapRequest);
  const [all, setAll] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [sameMuscle, setSameMuscle] = useState(true);
  const picking = useRef(false);
  const firstPaint = useRef(true);

  useEffect(() => {
    if (!request) router.back();
  }, [request]);

  useEffect(() => {
    listExercises(db).then(setAll);
  }, [db]);

  useEffect(() => {
    if (all.length) firstPaint.current = false;
  }, [all]);

  const shown = useMemo(() => {
    if (!request) return [];
    const { current, planned, takenIds } = request;
    const q = normalize(query);
    const isPlanned = (e: Exercise) => e.id === planned.id;
    return all
      .filter(
        (e) =>
          e.id !== current.id &&
          !takenIds.includes(e.id) &&
          // A search looks everywhere; otherwise stay with the muscle being trained.
          (q ? normalize(searchText(e)).includes(q) : !sameMuscle || e.muscle === current.muscle),
      )
      .sort(
        (a, b) =>
          Number(isPlanned(b)) - Number(isPlanned(a)) ||
          closeness(a, current) - closeness(b, current) ||
          a.name.localeCompare(b.name),
      );
  }, [all, query, sameMuscle, request]);

  if (!request) return null;

  const pick = async (exercise: Exercise) => {
    if (picking.current) return;
    picking.current = true;
    try {
      await request.onPick(exercise);
      router.back();
    } catch {
      picking.current = false;
    }
  };

  return (
    <StackScreen label="Swap for today">
      <View style={styles.body}>
        <Animated.View entering={rise(60)} style={styles.intro}>
          <Text style={styles.title} numberOfLines={2}>
            Instead of {request.current.name}
          </Text>
          <Text style={styles.meta}>Only for this session. Your plan stays as it is.</Text>
        </Animated.View>

        <Animated.View entering={rise(120)} style={styles.search}>
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

        <Animated.View entering={rise(180)} style={styles.chips}>
          <Chip
            label={muscleLabel(request.current.muscle)}
            selected={sameMuscle}
            onPress={() => setSameMuscle(true)}
          />
          <Chip label="All" selected={!sameMuscle} onPress={() => setSameMuscle(false)} />
        </Animated.View>

        <FadeScrollView>
          {shown.map((e, i) => (
            <Animated.View key={e.id} entering={firstPaint.current ? rise(220 + Math.min(i, 10) * 40) : undefined}>
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Swaps it in for this session"
                onPress={() => pick(e)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <ExerciseThumb media={e.media} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{e.name}</Text>
                  <TargetsLine exercise={e} />
                  <Text style={styles.meta}>
                    {e.id === request.planned.id ? 'From your plan' : equipmentLabel(e)}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          ))}
          {all.length > 0 && shown.length === 0 && (
            <Text style={[styles.meta, styles.empty]}>
              {query.trim() ? `Nothing matches “${query.trim()}”.` : 'Nothing else here. Try All.'}
            </Text>
          )}
        </FadeScrollView>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: space[4] },
  intro: { gap: space[1] },
  title: { ...type.title, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
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
  chips: { flexDirection: 'row', gap: space[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
    borderBottomWidth: size.divider,
    borderBottomColor: colors.hairline,
  },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1 },
  rowName: { ...type.bodyStrong, color: colors.ink },
  empty: { paddingVertical: space[4] },
});
