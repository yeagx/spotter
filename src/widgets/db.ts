import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS } from '@/db/schema';

// The database as the widgets read it, on Android and iPhone alike.

let opened: Promise<SQLiteDatabase> | null = null;

// The app's own database file. Widgets render in the background, sometimes with the app
// closed, so they open it themselves rather than borrowing the screens' connection.
export function widgetDb(): Promise<SQLiteDatabase> {
  opened ??= openDatabaseAsync('spotter.db').then(async (db) => {
    await db.execAsync('PRAGMA foreign_keys = ON;');
    return db;
  });
  return opened;
}

// Only the app migrates. Until it has (first install, or just after an update), the
// widgets show the set-up card rather than read a half-built schema.
export async function schemaReady(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return (row?.user_version ?? 0) >= MIGRATIONS.length;
}
