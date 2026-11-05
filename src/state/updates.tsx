import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getMeta, setMeta } from '@/db/meta';
import { APP_VERSION, checkForUpdate, isNewer, type Release } from '@/lib/updates';

// A quiet daily check for a new version. At most once a day, when the app opens or comes
// back to the front, it asks GitHub in the background. A newer release shows as a small
// dot on the avatar on Today and is waiting in Profile → Updates. No pop-up, no banner.

const CHECKED_KEY = 'update_checked_at';
const FOUND_KEY = 'update_found'; // the newer release last seen, as JSON, or ''
const DAY_MS = 24 * 60 * 60 * 1000;

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
    },
    [db],
  );

  useEffect(() => {
    let active = true;

    const checkIfDue = async () => {
      const last = Number((await getMeta(db, CHECKED_KEY)) ?? 0);
      if (Date.now() - last < DAY_MS) return;
      try {
        const result = await checkForUpdate();
        if (active) remember(result.status === 'available' ? result.release : null);
      } catch {
        // Offline or GitHub unreachable: say nothing, try again next time.
      }
    };

    (async () => {
      // Show what an earlier check found straight away. Once that version (or a later
      // one) is installed, it's no longer newer, so the dot goes by itself.
      const cached = parseRelease(await getMeta(db, FOUND_KEY));
      if (active && cached && isNewer(cached.version, APP_VERSION)) setAvailable(cached);
      await checkIfDue();
    })();

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
