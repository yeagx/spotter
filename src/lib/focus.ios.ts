import type { SQLiteDatabase } from 'expo-sqlite';

import { getMeta, setMeta } from '@/db/meta';

import { SHORTCUT_OFF, SHORTCUT_ON, runShortcut } from './focusShortcuts';

// Focus mode on iPhone: the user's own two shortcuts switch their Focus on as a session
// starts and off as it ends (lib/focusShortcuts.ts says why). Same shape as Android's
// focus.ts, so LiveSessionHost drives both the same way, and the same promise: Spotter
// only undoes what it did, remembered in meta so a session that ended with the app
// closed still gets its Focus turned off on the next launch.

const KEY = 'focus_dnd';
const SET_UP = 'focus_shortcuts'; // 'yes' once the user says the shortcuts are added

// A Live Activity can only start with Spotter on screen, and it starts as the workout
// opens: give it that moment before Shortcuts takes the front.
const AFTER_START_MS = 1200;

export type FocusEnter = 'on' | 'already' | 'no-access' | null;

export const focusShortcutsAdded = async (db: SQLiteDatabase) => (await getMeta(db, SET_UP)) === 'yes';
export const setFocusShortcutsAdded = (db: SQLiteDatabase, added: boolean) => setMeta(db, SET_UP, added ? 'yes' : '');

export async function enterFocus(db: SQLiteDatabase): Promise<FocusEnter> {
  if (await getMeta(db, KEY)) return null; // already done for this session
  if (!(await focusShortcutsAdded(db))) return 'no-access';
  await setMeta(db, KEY, 'on');
  setTimeout(() => runShortcut(SHORTCUT_ON), AFTER_START_MS);
  return 'on';
}

// True when Spotter ran the Off shortcut.
export async function leaveFocus(db: SQLiteDatabase): Promise<boolean> {
  const did = await getMeta(db, KEY);
  if (!did) return false;
  await setMeta(db, KEY, '');
  if (did !== 'on') return false;
  return runShortcut(SHORTCUT_OFF);
}
