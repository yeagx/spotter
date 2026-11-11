import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PencilIcon } from '@/components/Icons';
import { getExerciseNote, setExerciseNote } from '@/db/exercises';
import { colors, radius, size, space, type } from '@/theme';

const MAX_LENGTH = 80;

// Your own reminder for an exercise: "seat 4, narrow grip". One line, kept with the
// exercise, shown wherever you train it. Tap to write or change it; it saves when you
// leave the field. Reads from the database each time the screen comes back, so a note
// written on the exercise page is there when you return to the workout.
export function ExerciseNote({ exerciseId }: { exerciseId: string }) {
  const db = useSQLiteContext();
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null); // non-null while editing

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getExerciseNote(db, exerciseId).then((n) => {
        if (active) setNote(n);
      });
      return () => {
        active = false;
      };
    }, [db, exerciseId]),
  );

  const save = () => {
    if (draft === null) return;
    const next = draft.trim() || null;
    setDraft(null);
    if (next === note) return;
    setNote(next);
    setExerciseNote(db, exerciseId, next ?? '').catch(() => setNote(note));
  };

  if (draft !== null) {
    return (
      <TextInput
        accessibilityLabel="Note for this exercise"
        value={draft}
        onChangeText={setDraft}
        onBlur={save}
        onSubmitEditing={save}
        autoFocus
        maxLength={MAX_LENGTH}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        placeholder="Seat 4, narrow grip"
        placeholderTextColor={colors.inkFaint}
        selectionColor={colors.inkMuted}
        cursorColor={colors.ink}
        style={styles.input}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={note ? `Note: ${note}` : 'Add a note'}
      accessibilityHint="Edits your note for this exercise"
      onPress={() => setDraft(note ?? '')}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <PencilIcon size={size.iconXs} color={note ? colors.inkMuted : colors.inkFaint} />
      <View style={styles.text}>
        <Text style={note ? styles.note : styles.empty}>{note ?? 'Add a note'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: size.tapTarget },
  pressed: { opacity: 0.6 },
  text: { flex: 1 },
  note: { ...type.body, color: colors.ink },
  empty: { ...type.caption, color: colors.inkMuted },
  input: {
    ...type.body,
    minHeight: size.tapTarget,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.ink,
  },
});
