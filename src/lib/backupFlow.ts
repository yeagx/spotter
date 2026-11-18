import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';

import { dataChanged } from '@/db/changes';
import { describeBackup, pickBackup, restoreBackup, shareBackup } from '@/lib/backup';
import { confirmDestructive, notify } from '@/lib/confirm';
import { formatDay, localDate } from '@/lib/dates';
import { loadLive } from '@/state/liveSession';

// The back up and restore steps as the user sees them: pick, ask, do, say how it went.
// Shared by Profile and the first onboarding step (a new phone starts there).

export async function backUp(db: SQLiteDatabase): Promise<void> {
  try {
    await shareBackup(db);
  } catch (e) {
    if (__DEV__) console.warn('Backup failed', e);
    notify('Couldn’t back up', 'Something went wrong making the file. Try again.');
  }
}

// `reload` refreshes the profile the app is holding. Resolves true once restored.
export async function restore(db: SQLiteDatabase, reload: () => Promise<void>): Promise<boolean> {
  let file;
  try {
    file = await pickBackup();
  } catch {
    notify('Couldn’t open that', 'Try picking the file again.');
    return false;
  }
  if (!file) return false;

  const info = await describeBackup(file);
  if (!info) {
    notify('Not a Spotter backup', 'Pick the .spotter file you saved from Spotter on your other phone.');
    return false;
  }
  const ok = await confirmDestructive({
    title: 'Replace everything?',
    message: `This backup is from ${formatDay(localDate(new Date(info.createdAt)))}, with ${info.sessions} ${
      info.sessions === 1 ? 'session' : 'sessions'
    }. Everything in Spotter on this phone is replaced by it.`,
    confirmLabel: 'Restore',
    cancelLabel: 'Cancel',
  });
  if (!ok) return false;

  const problem = await restoreBackup(db, file);
  if (problem === 'not-a-backup') {
    notify('Not a Spotter backup', 'Pick the .spotter file you saved from Spotter on your other phone.');
    return false;
  }
  if (problem === 'newer') {
    notify('Update Spotter first', 'This backup was made by a newer Spotter. Update this one, then restore it.');
    return false;
  }
  if (problem) {
    notify('Couldn’t restore', 'Nothing on this phone was changed. Try again.');
    return false;
  }

  await reload();
  await loadLive(db).catch(() => {});
  dataChanged();
  router.replace('/');
  notify('Restored', 'Your plan, sessions and check-ins are all here.');
  return true;
}
