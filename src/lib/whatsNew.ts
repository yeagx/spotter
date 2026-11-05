import type { SQLiteDatabase } from 'expo-sqlite';

import { WHATS_NEW, type WhatsNewEntry } from '@/config/whatsNew';
import { getMeta, setMeta } from '@/db/meta';
import { APP_VERSION, isNewer } from '@/lib/updates';

// The last version whose notes this phone has seen, in the meta table.
const SEEN_KEY = 'whats_new_seen';

// Installs from before What's new existed have no record; they were on the first release.
const FIRST_RELEASE = '1.0.0';

// Entries newer than `since`, up to the installed version, newest first.
export function notesSince(since: string, current = APP_VERSION): WhatsNewEntry[] {
  return WHATS_NEW.filter((e) => isNewer(e.version, since) && !isNewer(e.version, current));
}

// The notes for the installed version alone (Profile → What's new).
export const currentNotes = () => WHATS_NEW.find((e) => e.version === APP_VERSION) ?? null;

// What to show on this open: notes from every version installed since the last one seen.
// Empty when there's nothing new, including fixes-only updates.
export async function unseenNotes(db: SQLiteDatabase): Promise<{ since: string; entries: WhatsNewEntry[] }> {
  const since = (await getMeta(db, SEEN_KEY)) ?? FIRST_RELEASE;
  return { since, entries: notesSince(since) };
}

// Called once the notes are on screen, and for new users (they get the tour instead).
export const markNotesSeen = (db: SQLiteDatabase) => setMeta(db, SEEN_KEY, APP_VERSION);
