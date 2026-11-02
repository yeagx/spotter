import type { SQLiteDatabase } from 'expo-sqlite';

import type { Equipment, Exercise, Muscle } from './types';

type ExerciseRow = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  cues_json: string;
  media_json: string | null;
  is_custom: number;
};

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    muscle: row.muscle as Muscle,
    equipment: row.equipment as Equipment,
    cues: JSON.parse(row.cues_json),
    media: row.media_json ? JSON.parse(row.media_json) : null,
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
