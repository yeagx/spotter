import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getMeta, setMeta } from '@/db/meta';
import { CHECKED_KEY, FOUND_KEY, NOTIFIED_KEY, checkAndRecord } from '@/lib/updateNotice';
import { APP_VERSION, isNewer, type Release } from '@/lib/updates';
import { scheduleUpdateChecks } from '@/lib/updateTask';

// Knowing about a new version without asking. When the app opens or comes back to the
// front (at most every half hour), it asks GitHub; with the app closed, a background
// task does the same every few hours and sends a notification (lib/updateTask.ts). A
// newer release shows as a small dot on the avatar on Today and waits in Profile.

const EVERY_MS = 30 * 60 * 1000;

type UpdatesState = {
  available: Release | null; // a release newer than this build, if one is known
  remember: (release: Release | null) => void; // record a check's result (Profile's button too)
};

const UpdatesContext = createContext<UpdatesState>({ available: null, remember: () => {} });

export function UpdatesProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [available, setAvailable] = useState<Release | null>(null);

  const remember = useCallback(
    (release: Release | null) => {
      setAvailable(release);
      setMeta(db, FOUND_KEY, release ? JSON.stringify(release) : '');
      setMeta(db, CHECKED_KEY, String(Date.now()));
      // Found in Profile: already seen, so the background check won't notify about it.
      if (release) setMeta(db, NOTIFIED_KEY, release.version);
    },
    [db],
  );

  useEffect(() => {
    let active = true;

    // Shows what the last check found, here or in the background. Once that version (or
    // a later one) is installed, it's no longer newer, so the dot goes by itself.
    const showFound = async () => {
      const found = parseRelease(await getMeta(db, FOUND_KEY));
      if (active) setAvailable(found && isNewer(found.version, APP_VERSION) ? found : null);
    };

    const checkIfDue = async () => {
      await showFound();
      const last = Number((await getMeta(db, CHECKED_KEY)) ?? 0);
      if (Date.now() - last < EVERY_MS) return;
      try {
        // Found with the app open: the dot says it, so no notification follows.
        const release = await checkAndRecord(db, { notify: false });
        if (active) setAvailable(release);
      } catch {
        // Offline or GitHub unreachable: say nothing, try again next time.
      }
    };

    checkIfDue();
    scheduleUpdateChecks();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkIfDue();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [db, remember]);

  return <UpdatesContext.Provider value={{ available, remember }}>{children}</UpdatesContext.Provider>;
}

export const useUpdates = () => useContext(UpdatesContext);

function parseRelease(json: string | null): Release | null {
  if (!json) return null;
  try {
    const r = JSON.parse(json) as Release;
    return r && typeof r.version === 'string' && typeof r.url === 'string' ? r : null;
  } catch {
    return null;
  }
}
