import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Equipment, Exercise, ExerciseMedia, Muscle } from './types';

export type ExerciseRow = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  cues_json: string;
  media_json: string | null;
  targets_json: string | null;
  note: string | null;
  is_custom: number;
};

export function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    muscle: row.muscle as Muscle,
    equipment: row.equipment as Equipment,
    cues: JSON.parse(row.cues_json),
    media: row.media_json ? JSON.parse(row.media_json) : null,
    targets: row.targets_json ? JSON.parse(row.targets_json) : null,
    note: row.note,
    isCustom: row.is_custom === 1,
  };
}

// The library picker's query: optional muscle filter plus a name search.
export async function listExercises(
  db: SQLiteDatabase,
  { muscle, search }: { muscle?: Muscle; search?: string } = {},
): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT * FROM exercise
     WHERE ($muscle IS NULL OR muscle = $muscle)
       AND ($search IS NULL OR name LIKE '%' || $search || '%')
     ORDER BY name`,
    { $muscle: muscle ?? null, $search: search?.trim() || null },
  );
  return rows.map(toExercise);
}

export async function getExercise(db: SQLiteDatabase, id: string): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercise WHERE id = ?', id);
  return row ? toExercise(row) : null;
}

// Custom exercises get a UUID (never a slug) so they can't collide with library ids.
// `media` is a photo or clip the user attached, if any.
export async function createCustomExercise(
  db: SQLiteDatabase,
  { name, muscle, media = null }: { name: string; muscle: Muscle; media?: ExerciseMedia | null },
): Promise<Exercise> {
  const now = Date.now();
  const exercise: Exercise = {
    id: randomUUID(),
    name: name.trim(),
    muscle,
    equipment: 'other',
    cues: [],
    media,
    targets: null,
    note: null,
    isCustom: true,
  };
  await db.runAsync(
    `INSERT INTO exercise
       (id, name, muscle, equipment, cues_json, media_json, is_custom, created_at, updated_at)
     VALUES (?, ?, ?, ?, '[]', ?, 1, ?, ?)`,
    exercise.id,
    exercise.name,
    exercise.muscle,
    exercise.equipment,
    media ? JSON.stringify(media) : null,
    now,
    now,
  );
  return exercise;
}

// Attaches, replaces or clears (null) the demo on a custom exercise. Library rows are
// left alone: their media belongs to the seed.
export async function setCustomExerciseMedia(
  db: SQLiteDatabase,
  id: string,
  media: ExerciseMedia | null,
): Promise<void> {
  await db.runAsync(
    'UPDATE exercise SET media_json = ?, updated_at = ? WHERE id = ? AND is_custom = 1',
    media ? JSON.stringify(media) : null,
    Date.now(),
    id,
  );
}

// The user's own reminder for an exercise. Empty text clears it.
export async function setExerciseNote(db: SQLiteDatabase, id: string, note: string): Promise<void> {
  await db.runAsync(
    'UPDATE exercise SET note = ?, updated_at = ? WHERE id = ?',
    note.trim() || null,
    Date.now(),
    id,
  );
}

export async function getExerciseNote(db: SQLiteDatabase, id: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ note: string | null }>('SELECT note FROM exercise WHERE id = ?', id);
  return row?.note ?? null;
}
