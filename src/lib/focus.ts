import type { SQLiteDatabase } from 'expo-sqlite';

import { getMeta, setMeta } from '@/db/meta';
import { DND_OFF, DND_PRIORITY, getDnd, hasDndAccess, setDnd } from '@/lib/media';
import { setRestFocus } from '@/lib/restAlert';

// Focus mode: Do Not Disturb (priority only, so alarms and starred contacts still get
// through) for as long as a session is open. Spotter only ever undoes what it did: if
// Do Not Disturb was already on when the session started, it's left alone, and if you
// turn it off yourself mid-session, it stays off.
//
// What Spotter did is kept in meta, so a session that ended with the app closed (or a
// crash) still gets its Do Not Disturb taken back on the next launch.

const KEY = 'focus_dnd';

export async function enterFocus(db: SQLiteDatabase): Promise<void> {
  if (!hasDndAccess()) return;
  if (await getMeta(db, KEY)) {
    setRestFocus(getDnd() === DND_PRIORITY);
    return; // already done for this session
  }
  if (getDnd() !== DND_OFF) {
    await setMeta(db, KEY, 'untouched'); // it was already on: not ours to turn off
    setRestFocus(true);
    return;
  }
  if (setDnd(DND_PRIORITY)) {
    await setMeta(db, KEY, 'on');
    setRestFocus(true);
  }
}

export async function leaveFocus(db: SQLiteDatabase): Promise<void> {
  const did = await getMeta(db, KEY);
  setRestFocus(false);
  if (!did) return;
  if (did === 'on' && getDnd() === DND_PRIORITY) setDnd(DND_OFF);
  await setMeta(db, KEY, '');
}
