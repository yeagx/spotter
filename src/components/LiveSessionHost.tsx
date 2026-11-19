import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { enterFocus, leaveFocus } from '@/lib/focus';
import { haptic } from '@/lib/haptics';
import { clearLiveWorkout, onLiveAction } from '@/lib/liveWorkout';
import { playRestDone } from '@/lib/restAlert';
import { useProfile } from '@/state/profile';
import {
  loadLive,
  patchLive,
  setPendingLiveAction,
  useLive,
  useWorkoutOpen,
} from '@/state/liveSession';

// Looks after a session while its workout screen is closed (left with Back to browse
// the app): finds an open session at launch, sounds the end of a rest like the workout
// would, and hands a lock-screen Log set / Skip rest to the workout by opening it.
// Also runs Focus mode: Do Not Disturb on while any session is open, off once it ends.
// Renders nothing.
export function LiveSessionHost() {
  const db = useSQLiteContext();
  const { profile } = useProfile();
  const live = useLive();
  const workoutOpen = useWorkoutOpen();
  const alertMode = profile?.restAlert ?? 'sound';

  // Until the open session has been looked up, "no session" isn't known yet, and Focus
  // mode mustn't switch Do Not Disturb off just to switch it back on.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    loadLive(db)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [db]);

  // A session that ended with the app closed can leave its lock-screen card behind (an
  // iPhone Live Activity outlives the app). With no session open, take it down.
  const hasLive = Boolean(live);
  useEffect(() => {
    if (loaded && !hasLive) clearLiveWorkout();
  }, [loaded, hasLive]);

  // Focus is felt, not shown: a locking-in click as Do Not Disturb turns on with a
  // session, a soft click as it turns off at the end. Only when Spotter changed it.
  const focusOn = Boolean(profile?.focusMode && live);
  const sessionId = live?.id ?? null;
  useEffect(() => {
    if (!loaded || profile === undefined) return;
    if (!focusOn) {
      leaveFocus(db)
        .then((off) => off && haptic.focusOff())
        .catch(() => {});
      return;
    }
    enterFocus(db)
      .then((r) => r === 'on' && haptic.focusOn())
      .catch(() => {});
  }, [db, loaded, profile, focusOn]);

  const restEndsAt = live?.restEndsAt ?? null;
  useEffect(() => {
    if (workoutOpen || restEndsAt === null) return;
    const wait = restEndsAt - Date.now();
    if (wait <= 0) return;
    const t = setTimeout(() => {
      playRestDone(alertMode);
      patchLive({ restEndsAt: null });
    }, wait);
    return () => clearTimeout(t);
  }, [workoutOpen, restEndsAt, alertMode]);

  useEffect(() => {
    if (workoutOpen || !sessionId) return;
    return onLiveAction((action) => {
      setPendingLiveAction(action);
      router.push({ pathname: '/workout/[id]', params: { id: sessionId } });
    });
  }, [workoutOpen, sessionId]);

  return null;
}
