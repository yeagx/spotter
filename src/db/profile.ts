import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

export type Goal = 'lean' | 'healthy';
export type Units = 'kg' | 'lb';
export type CalorieMode = 'estimate' | 'custom';
export type Sex = 'male' | 'female';

export type Profile = {
  id: string;
  name: string;
  photoUri: string | null;
  goal: Goal;
  sex: Sex | null; // for body normal ranges
  units: Units;
  targetKg: number | null;
  targetFat: number | null;
  calorieMode: CalorieMode;
  calorieTarget: number | null; // only used when calorieMode is 'custom'
};

type ProfileRow = {
  id: string;
  name: string;
  photo_uri: string | null;
  goal: Goal;
  sex: Sex | null;
  units: Units;
  target_kg: number | null;
  target_fat: number | null;
  calorie_mode: CalorieMode;
  calorie_target: number | null;
};

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  name: r.name,
  photoUri: r.photo_uri,
  goal: r.goal,
  sex: r.sex,
  units: r.units,
  targetKg: r.target_kg,
  targetFat: r.target_fat,
  calorieMode: r.calorie_mode,
  calorieTarget: r.calorie_target,
});

// One profile per install in v1.
export async function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  const row = await db.getFirstAsync<ProfileRow>(
    'SELECT * FROM profile ORDER BY created_at LIMIT 1',
  );
  return row ? toProfile(row) : null;
}

export async function createProfile(
  db: SQLiteDatabase,
  p: Omit<Profile, 'id' | 'units'>,
): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO profile
       (id, name, photo_uri, goal, sex, units, target_kg, target_fat, calorie_mode,
        calorie_target, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'kg', ?, ?, ?, ?, ?, ?)`,
    randomUUID(),
    p.name,
    p.photoUri,
    p.goal,
    p.sex,
    p.targetKg,
    p.targetFat,
    p.calorieMode,
    p.calorieTarget,
    now,
    now,
  );
}

const COLUMNS: Record<keyof Omit<Profile, 'id'>, string> = {
  name: 'name',
  photoUri: 'photo_uri',
  goal: 'goal',
  sex: 'sex',
  units: 'units',
  targetKg: 'target_kg',
  targetFat: 'target_fat',
  calorieMode: 'calorie_mode',
  calorieTarget: 'calorie_target',
};

export async function updateProfile(
  db: SQLiteDatabase,
  id: string,
  changes: Partial<Omit<Profile, 'id'>>,
): Promise<void> {
  const keys = Object.keys(changes) as (keyof typeof COLUMNS)[];
  if (!keys.length) return;
  const sets = keys.map((k) => `${COLUMNS[k]} = ?`).join(', ');
  await db.runAsync(
    `UPDATE profile SET ${sets}, updated_at = ? WHERE id = ?`,
    ...keys.map((k) => changes[k] ?? null),
    Date.now(),
    id,
  );
}
