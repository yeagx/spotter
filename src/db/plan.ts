import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { dataChanged } from './changes';
import { toExercise, type ExerciseRow } from './exercises';
import type { Exercise, Weekday } from './types';

export type DayExercise = {
  id: string;
  exercise: Exercise;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
};

export type SplitDay = {
  id: string;
  weekday: Weekday | null;
  name: string;
  exercises: DayExercise[];
};

export type Split = {
  id: string;
  name: string;
  days: SplitDay[]; // in position order
};

// What a freshly added exercise starts with; the user tunes it in Edit day.
export const DEFAULT_SCHEME = { sets: 3, repsMin: 8, repsMax: 12, restSec: 90 };

type DayRow = { id: string; weekday: number | null; name: string };
type DayExerciseRow = ExerciseRow & {
  de_id: string;
  split_day_id: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_sec: number;
};

const DAY_EXERCISE_SELECT = `
  SELECT de.id AS de_id, de.split_day_id, de.sets, de.reps_min, de.reps_max, de.rest_sec,
         e.id, e.name, e.muscle, e.equipment, e.cues_json, e.media_json, e.targets_json, e.note,
         e.is_custom
  FROM day_exercise de
  JOIN exercise e ON e.id = de.exercise_id`;

function toDayExercise(row: DayExerciseRow): DayExercise {
  return {
    id: row.de_id,
    exercise: toExercise(row),
    sets: row.sets,
    repsMin: row.reps_min,
    repsMax: row.reps_max,
    restSec: row.rest_sec,
  };
}

function toDay(row: DayRow, exercises: DayExercise[]): SplitDay {
  return { id: row.id, weekday: row.weekday as Weekday | null, name: row.name, exercises };
}

// v1 has a single split: the first one created.
async function firstSplitRow(db: SQLiteDatabase) {
  return db.getFirstAsync<{ id: string; name: string }>(
    'SELECT id, name FROM split ORDER BY created_at LIMIT 1',
  );
}

export async function getSplit(db: SQLiteDatabase): Promise<Split | null> {
  const split = await firstSplitRow(db);
  if (!split) return null;

  const days = await db.getAllAsync<DayRow>(
    'SELECT id, weekday, name FROM split_day WHERE split_id = ? ORDER BY position',
    split.id,
  );
  const rows = await db.getAllAsync<DayExerciseRow>(
    `${DAY_EXERCISE_SELECT}
     WHERE de.split_day_id IN (SELECT id FROM split_day WHERE split_id = ?)
     ORDER BY de.position`,
    split.id,
  );

  const byDay = new Map<string, DayExercise[]>();
  for (const row of rows) {
    const list = byDay.get(row.split_day_id) ?? [];
    list.push(toDayExercise(row));
    byDay.set(row.split_day_id, list);
  }
  return {
    id: split.id,
    name: split.name,
    days: days.map((d) => toDay(d, byDay.get(d.id) ?? [])),
  };
}

export async function getDay(db: SQLiteDatabase, dayId: string): Promise<SplitDay | null> {
  const day = await db.getFirstAsync<DayRow>(
    'SELECT id, weekday, name FROM split_day WHERE id = ?',
    dayId,
  );
  if (!day) return null;
  const rows = await db.getAllAsync<DayExerciseRow>(
    `${DAY_EXERCISE_SELECT} WHERE de.split_day_id = ? ORDER BY de.position`,
    dayId,
  );
  return toDay(day, rows.map(toDayExercise));
}

// Writes the split's name and which weekdays train. Days that stay keep their id and
// exercises; days switched off are deleted with their exercises (sessions keep their
// history, the schema only unlinks them). `weekdays` must be in display order.
export async function saveSplit(
  db: SQLiteDatabase,
  { name, weekdays }: { name: string; weekdays: Weekday[] },
): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    const existing = await firstSplitRow(db);
    const splitId = existing?.id ?? randomUUID();
    if (existing) {
      await db.runAsync(
        'UPDATE split SET name = ?, updated_at = ? WHERE id = ?',
        name,
        now,
        splitId,
      );
    } else {
      await db.runAsync(
        'INSERT INTO split (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        splitId,
        name,
        now,
        now,
      );
    }

    const days = await db.getAllAsync<{ id: string; weekday: number | null }>(
      'SELECT id, weekday FROM split_day WHERE split_id = ?',
      splitId,
    );
    for (const day of days) {
      if (day.weekday !== null && !weekdays.includes(day.weekday as Weekday)) {
        await db.runAsync('DELETE FROM split_day WHERE id = ?', day.id);
      }
    }
    for (const [position, weekday] of weekdays.entries()) {
      const day = days.find((d) => d.weekday === weekday);
      if (day) {
        await db.runAsync(
          'UPDATE split_day SET position = ?, updated_at = ? WHERE id = ?',
          position,
          now,
          day.id,
        );
      } else {
        // Name starts empty; screens show "New day" until the user names it.
        await db.runAsync(
          `INSERT INTO split_day (id, split_id, weekday, name, position, created_at, updated_at)
           VALUES (?, ?, ?, '', ?, ?, ?)`,
          randomUUID(),
          splitId,
          weekday,
          position,
          now,
          now,
        );
      }
    }
  });
  dataChanged();
}

export type DayExerciseDraft = {
  id: string;
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
};

// Replaces a day's name and exercise list with the edited draft, in its order.
export async function saveDay(
  db: SQLiteDatabase,
  dayId: string,
  { name, exercises }: { name: string; exercises: DayExerciseDraft[] },
): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE split_day SET name = ?, updated_at = ? WHERE id = ?',
      name,
      now,
      dayId,
    );

    const keep = new Set(exercises.map((e) => e.id));
    const current = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM day_exercise WHERE split_day_id = ?',
      dayId,
    );
    for (const row of current) {
      if (!keep.has(row.id)) await db.runAsync('DELETE FROM day_exercise WHERE id = ?', row.id);
    }

    for (const [position, e] of exercises.entries()) {
      await db.runAsync(
        `INSERT INTO day_exercise
           (id, split_day_id, exercise_id, sets, reps_min, reps_max, rest_sec, position,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           sets = excluded.sets,
           reps_min = excluded.reps_min,
           reps_max = excluded.reps_max,
           rest_sec = excluded.rest_sec,
           position = excluded.position,
           updated_at = excluded.updated_at`,
        e.id,
        dayId,
        e.exerciseId,
        e.sets,
        e.repsMin,
        e.repsMax,
        e.restSec,
        position,
        now,
        now,
      );
    }
  });
  dataChanged();
}

// Appends exercises to the end of a day with the default scheme (Plan's quick add).
export async function addExercisesToDay(
  db: SQLiteDatabase,
  dayId: string,
  exerciseIds: string[],
): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ next: number }>(
      'SELECT COALESCE(MAX(position) + 1, 0) AS next FROM day_exercise WHERE split_day_id = ?',
      dayId,
    );
    let position = row?.next ?? 0;
    for (const exerciseId of exerciseIds) {
      await db.runAsync(
        `INSERT INTO day_exercise
           (id, split_day_id, exercise_id, sets, reps_min, reps_max, rest_sec, position,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(),
        dayId,
        exerciseId,
        DEFAULT_SCHEME.sets,
        DEFAULT_SCHEME.repsMin,
        DEFAULT_SCHEME.repsMax,
        DEFAULT_SCHEME.restSec,
        position++,
        now,
        now,
      );
    }
  });
  dataChanged();
}
