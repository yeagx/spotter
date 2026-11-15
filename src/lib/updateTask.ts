import * as BackgroundTask from 'expo-background-task';
import * as SQLite from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';

import { checkAndRecord } from '@/lib/updateNotice';

// The update check that runs with Spotter closed. Android picks the exact moment (it
// batches background work to save battery); EVERY_MINUTES is the shortest gap.
const TASK = 'spotter-update-check';
const EVERY_MINUTES = 3 * 60;

// The task body. It runs without any screen, so it opens the database itself (the app
// has already created and migrated it by the time the task is registered).
TaskManager.defineTask(TASK, async () => {
  try {
    const db = await SQLite.openDatabaseAsync('spotter.db');
    await checkAndRecord(db, { notify: true });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Called on every launch; does nothing once registered.
export async function scheduleUpdateChecks() {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(TASK)) return;
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: EVERY_MINUTES });
  } catch {
    // No background work on this device: the in-app check still runs.
  }
}

