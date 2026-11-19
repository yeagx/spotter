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

// What just happened, so the app can say so: Spotter turned it on, it was already on,
// there's no access to turn it on, or nothing (already handled for this session).
export type FocusEnter = 'on' | 'already' | 'no-access' | null;

// iPhone's Focus mode runs shortcuts the user adds (focus.ios.ts). Android needs none.
export const focusShortcutsAdded = async (_db: SQLiteDatabase) => true;
export const setFocusShortcutsAdded = async (_db: SQLiteDatabase, _added: boolean) => {};

export async function enterFocus(db: SQLiteDatabase): Promise<FocusEnter> {
  if (await getMeta(db, KEY)) {
    setRestFocus(getDnd() === DND_PRIORITY);
    return null; // already done for this session
  }
  if (!hasDndAccess()) return 'no-access';
  if (getDnd() !== DND_OFF) {
    await setMeta(db, KEY, 'untouched'); // it was already on: not ours to turn off
    setRestFocus(true);
    return 'already';
  }
  if (!setDnd(DND_PRIORITY)) return 'no-access';
  await setMeta(db, KEY, 'on');
  setRestFocus(true);
  return 'on';
}

// True when Spotter turned Do Not Disturb back off.
export async function leaveFocus(db: SQLiteDatabase): Promise<boolean> {
  const did = await getMeta(db, KEY);
  setRestFocus(false);
  if (!did) return false;
  let turnedOff = false;
  if (did === 'on' && getDnd() === DND_PRIORITY) turnedOff = setDnd(DND_OFF);
  await setMeta(db, KEY, '');
  return turnedOff;
}
