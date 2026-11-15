import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getMeta, setMeta } from '@/db/meta';
import { checkForUpdate, type Release } from '@/lib/updates';
import { colors } from '@/theme';

// Finding a new version without being asked. A background task (updateTask.ts) wakes
// every few hours, even with Spotter closed, and the app checks when it opens
// (state/updates.tsx). Both come here: ask GitHub, record what's out so the dot on Today
// is already there, and send one notification per new version.

export const UPDATE_NOTICE_ID = 'update-available';
const CHANNEL = 'updates';

export const CHECKED_KEY = 'update_checked_at';
export const FOUND_KEY = 'update_found'; // the newer release last seen, as JSON, or ''
export const NOTIFIED_KEY = 'update_notified'; // the version a notification was sent for

// Asks GitHub and records the answer. With `notify`, a newer version nobody has been
// told about yet gets a notification. Throws when GitHub can't be reached.
export async function checkAndRecord(
  db: SQLiteDatabase,
  { notify }: { notify: boolean },
): Promise<Release | null> {
  const result = await checkForUpdate();
  const release = result.status === 'available' ? result.release : null;
  await setMeta(db, FOUND_KEY, release ? JSON.stringify(release) : '');
  await setMeta(db, CHECKED_KEY, String(Date.now()));
  if (release && (await getMeta(db, NOTIFIED_KEY)) !== release.version) {
    // Seen in the app already counts as told; otherwise only mark it once it's sent.
    if (!notify || (await sendNotice(release))) await setMeta(db, NOTIFIED_KEY, release.version);
  }
  return release;
}

async function sendNotice(release: Release): Promise<boolean> {
  try {
    if (!(await Notifications.getPermissionsAsync()).granted) return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Updates',
        description: 'When a new version of Spotter is out.',
        importance: Notifications.AndroidImportance.DEFAULT,
        showBadge: false,
      });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: UPDATE_NOTICE_ID,
      content: {
        title: `Spotter ${release.version} is out`,
        body: 'Tap to see what’s new and update.',
        color: colors.spotterRed,
        data: { open: '/profile' },
      },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
    });
    return true;
  } catch {
    return false;
  }
}

// Whether a notification tap was the update notice, to open Profile.
export const isUpdateNotice = (r: Notifications.NotificationResponse | null | undefined) =>
  r?.notification.request.identifier === UPDATE_NOTICE_ID &&
  r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER;
