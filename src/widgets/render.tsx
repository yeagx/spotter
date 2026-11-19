import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { WidgetInfo } from 'react-native-android-widget';

import { MIGRATIONS } from '@/db/schema';

import { BestLiftWidget } from './BestLiftWidget';
import { BodyWidget } from './BodyWidget';
import { bestLiftModel, bodyModel, meModel, monthModel, startUri, todayModel } from './data';
import { MeWidget } from './MeWidget';
import { MonthWidget } from './MonthWidget';
import { StartWidget } from './StartWidget';
import { TodayWidget } from './TodayWidget';
import { SetUp, boxOf } from './ui';

// Names match the "widgets" list in app.json.
export const WIDGET_NAMES = ['Today', 'Month', 'BestLift', 'Body', 'Start', 'Me', 'MeSmall'] as const;

// The page each Today widget is showing, by widget id. Kept in memory only: a redraw after
// the app's been closed for good starts again at the first page, which is the right place.
export const todayPages = new Map<number, number>();

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
async function schemaReady(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return (row?.user_version ?? 0) >= MIGRATIONS.length;
}

export async function renderWidget(name: string, info: WidgetInfo) {
  const b = boxOf(info);
  try {
    const db = await widgetDb();
    if (!(await schemaReady(db))) return <SetUp b={b} />;
    switch (name) {
      case 'Today':
        return <TodayWidget m={await todayModel(db)} b={b} page={todayPages.get(info.widgetId) ?? 0} />;
      case 'Month':
        return <MonthWidget m={await monthModel(db)} b={b} />;
      case 'BestLift':
        return <BestLiftWidget m={await bestLiftModel(db, info.widgetId)} b={b} />;
      case 'Body':
        return <BodyWidget m={await bodyModel(db)} b={b} />;
      case 'Start':
        return <StartWidget uri={await startUri(db)} b={b} />;
      case 'Me':
      case 'MeSmall':
        return <MeWidget m={await meModel(db)} b={b} />;
    }
  } catch {
    // Fall through to the quiet card: a widget should never show an error.
  }
  return <SetUp b={b} hint={null} />;
}
