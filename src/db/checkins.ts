import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { removeAppPhoto } from '@/lib/photo';

import { dataChanged } from './changes';

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

// Progress photos: up to one per pose on a check-in.
export const POSES = ['front', 'side', 'back'] as const;
export type Pose = (typeof POSES)[number];
export type PhotoSet = Partial<Record<Pose, string>>; // pose -> file uri

// A photo with the check-in it belongs to, for comparing two dates.
export type ProgressPhoto = {
  checkinId: string;
  date: string;
  pose: Pose;
  uri: string;
  weight: number;
  fat: number | null;
};

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

export async function getCheckinPhotos(db: SQLiteDatabase, checkinId: string): Promise<PhotoSet> {
  const rows = await db.getAllAsync<{ pose: Pose; uri: string }>(
    'SELECT pose, uri FROM checkin_photo WHERE checkin_id = ?',
    checkinId,
  );
  return Object.fromEntries(rows.map((r) => [r.pose, r.uri]));
}

// Every progress photo, oldest check-in first.
export async function listProgressPhotos(db: SQLiteDatabase): Promise<ProgressPhoto[]> {
  return db.getAllAsync<ProgressPhoto>(
    `SELECT p.checkin_id AS checkinId, c.date, p.pose, p.uri, c.weight, c.fat
     FROM checkin_photo p JOIN checkin c ON c.id = p.checkin_id
     ORDER BY c.date, c.created_at`,
  );
}

const photoUris = async (db: SQLiteDatabase, checkinId: string) =>
  (
    await db.getAllAsync<{ uri: string }>('SELECT uri FROM checkin_photo WHERE checkin_id = ?', checkinId)
  ).map((r) => r.uri);

// One check-in per day: saving on a day that already has one replaces it.
// Pass `id` to edit a specific check-in (its date may change). `photos` are set by pose;
// when editing, it's the full set and poses missing from it are removed. A new check-in
// on a day that has photos keeps them. Files no longer used are deleted once saved.
export async function saveCheckin(
  db: SQLiteDatabase,
  input: CheckinInput,
  id?: string,
  photos?: PhotoSet,
): Promise<void> {
  const now = Date.now();
  let unused: string[] = [];
  await db.withTransactionAsync(async () => {
    const sameDay = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM checkin WHERE date = ? AND id != ?',
      input.date,
      id ?? '',
    );
    const targetId = id ?? sameDay?.id ?? randomUUID();
    const before = id || sameDay ? await photoUris(db, targetId) : [];
    if (id && sameDay) {
      // Editing a check-in onto a day that has another: the other one goes, but any
      // photo pose this one lacks comes along.
      await db.runAsync(
        `UPDATE checkin_photo SET checkin_id = ?, updated_at = ?
         WHERE checkin_id = ? AND pose NOT IN (SELECT pose FROM checkin_photo WHERE checkin_id = ?)`,
        targetId,
        now,
        sameDay.id,
        targetId,
      );
      before.push(...(await photoUris(db, sameDay.id)));
      await db.runAsync('DELETE FROM checkin WHERE id = ?', sameDay.id);
    }
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
    if (photos) {
      for (const pose of POSES) {
        const uri = photos[pose];
        if (uri) {
          await db.runAsync(
            `INSERT INTO checkin_photo (id, checkin_id, pose, uri, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (checkin_id, pose) DO UPDATE SET
               uri = excluded.uri, updated_at = excluded.updated_at`,
            randomUUID(),
            targetId,
            pose,
            uri,
            now,
            now,
          );
        } else if (id) {
          await db.runAsync('DELETE FROM checkin_photo WHERE checkin_id = ? AND pose = ?', targetId, pose);
        }
      }
    }
    const after = new Set(await photoUris(db, targetId));
    unused = before.filter((uri) => !after.has(uri));
  });
  unused.forEach(removeAppPhoto);
  dataChanged();
}

export async function deleteCheckin(db: SQLiteDatabase, id: string): Promise<void> {
  const uris = await photoUris(db, id);
  await db.runAsync('DELETE FROM checkin WHERE id = ?', id);
  uris.forEach(removeAppPhoto);
  dataChanged();
}
