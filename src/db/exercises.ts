import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Equipment, Exercise, Muscle } from './types';

export type ExerciseRow = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  cues_json: string;
  media_json: string | null;
  targets_json: string | null;
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
// No media: they have no demo.
export async function createCustomExercise(
  db: SQLiteDatabase,
  { name, muscle }: { name: string; muscle: Muscle },
): Promise<Exercise> {
  const now = Date.now();
  const exercise: Exercise = {
    id: randomUUID(),
    name: name.trim(),
    muscle,
    equipment: 'other',
    cues: [],
    media: null,
    targets: null,
    isCustom: true,
  };
  await db.runAsync(
    `INSERT INTO exercise
       (id, name, muscle, equipment, cues_json, media_json, is_custom, created_at, updated_at)
     VALUES (?, ?, ?, ?, '[]', NULL, 1, ?, ?)`,
    exercise.id,
    exercise.name,
    exercise.muscle,
    exercise.equipment,
    now,
    now,
  );
  return exercise;
}
