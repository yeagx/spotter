import type { SQLiteDatabase } from 'expo-sqlite';

import { exerciseVideos } from './exerciseVideos';
import { LIBRARY, LIBRARY_VERSION } from './library';
import { MIGRATIONS } from './schema';
import { TARGETS } from './targets';
import type { ExerciseMedia } from './types';

// Passed to <SQLiteProvider onInit>. Runs on every launch before any screen reads data.
export async function initDatabase(db: SQLiteDatabase) {
  // foreign_keys is per connection, so it has to be set every time.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  await seedLibrary(db);
}

async function migrate(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  // One transaction per step: a crash mid-upgrade leaves the last good version intact.
  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

// Writes the bundled library into `exercise`. Only runs when LIBRARY_VERSION goes up,
// and only ever touches library rows, so custom exercises and all logs are left alone.
async function seedLibrary(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'library_version'",
  );
  if (Number(row?.value ?? 0) >= LIBRARY_VERSION) return;

  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const e of LIBRARY) {
      // A filmed clip replaces the photo frames as soon as one is registered.
      const media: ExerciseMedia = {
        type: e.id in exerciseVideos ? 'video' : 'frames',
        key: e.id,
      };
      await db.runAsync(
        `INSERT INTO exercise
           (id, name, muscle, equipment, tracking, cues_json, media_json, targets_json, is_custom,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name,
           muscle = excluded.muscle,
           equipment = excluded.equipment,
           tracking = excluded.tracking,
           cues_json = excluded.cues_json,
           media_json = excluded.media_json,
           targets_json = excluded.targets_json,
           updated_at = excluded.updated_at
         WHERE exercise.is_custom = 0`,
        e.id,
        e.name,
        e.muscle,
        e.equipment,
        e.tracking ?? 'weight',
        JSON.stringify(e.cues),
        JSON.stringify(media),
        TARGETS[e.id] ? JSON.stringify(TARGETS[e.id]) : null,
        now,
        now,
      );
    }
    await db.runAsync(
      `INSERT INTO meta (key, value) VALUES ('library_version', ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      String(LIBRARY_VERSION),
    );
  });
}
