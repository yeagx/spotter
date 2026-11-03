import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

// A body check-in, usually copied from an InBody-style scan. Only weight is required.
// date is the local calendar day (YYYY-MM-DD); weight and bone are kg.
export type Checkin = {
  id: string;
  date: string;
  weight: number;
  bmi: number | null;
  fat: number | null;
  muscle: number | null;
  water: number | null;
  bone: number | null;
  bmr: number | null;
};

export type CheckinInput = Omit<Checkin, 'id'>;

const COLUMNS = 'id, date, weight, bmi, fat, muscle, water, bone, bmr';

// Oldest first, so charts read left to right.
export async function listCheckins(db: SQLiteDatabase): Promise<Checkin[]> {
  return db.getAllAsync<Checkin>(`SELECT ${COLUMNS} FROM checkin ORDER BY date, created_at`);
}

export async function getCheckin(db: SQLiteDatabase, id: string): Promise<Checkin | null> {
  return db.getFirstAsync<Checkin>(`SELECT ${COLUMNS} FROM checkin WHERE id = ?`, id);
}

export async function latestCheckin(db: SQLiteDatabase): Promise<Checkin | null> {
  return db.getFirstAsync<Checkin>(
    `SELECT ${COLUMNS} FROM checkin ORDER BY date DESC, created_at DESC LIMIT 1`,
  );
}

// One check-in per day: saving on a day that already has one replaces it.
// Pass `id` to edit a specific check-in (its date may change).
export async function saveCheckin(
  db: SQLiteDatabase,
  input: CheckinInput,
  id?: string,
): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    const sameDay = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM checkin WHERE date = ? AND id != ?',
      input.date,
      id ?? '',
    );
    const targetId = id ?? sameDay?.id ?? randomUUID();
    if (id && sameDay) await db.runAsync('DELETE FROM checkin WHERE id = ?', sameDay.id);
    await db.runAsync(
      `INSERT INTO checkin
         (id, date, weight, bmi, fat, muscle, water, bone, bmr, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         date = excluded.date, weight = excluded.weight, bmi = excluded.bmi,
         fat = excluded.fat, muscle = excluded.muscle, water = excluded.water,
         bone = excluded.bone, bmr = excluded.bmr, updated_at = excluded.updated_at`,
      targetId,
      input.date,
      input.weight,
      input.bmi,
      input.fat,
      input.muscle,
      input.water,
      input.bone,
      input.bmr,
      now,
      now,
    );
  });
}

export async function deleteCheckin(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM checkin WHERE id = ?', id);
}
