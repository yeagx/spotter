import { requireOptionalNativeModule } from 'expo';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

// Bridge to modules/spotter-media (Android): music controls sent as media-button presses
// to whichever app is playing, whether music is playing at all, and Do Not Disturb for
// Focus mode. None of it needs special access. On web, iOS, Expo Go or an APK built
// before the module existed, it's absent and everything here reports "not available".

export type MediaAction = 'play' | 'pause' | 'toggle' | 'next' | 'previous';

type Native = {
  isMusicActive(): boolean;
  sendMediaKey(action: MediaAction): boolean;
  hasDndAccess(): boolean;
  openDndSettings(): boolean;
  getInterruptionFilter(): number;
  setInterruptionFilter(filter: number): boolean;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('SpotterMedia') : null;

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

// ---------- Music ----------

// This build can control other apps' music.
export const mediaSupported = native != null;

export const isMusicActive = () => safe(() => native?.isMusicActive() ?? false, false);
export const mediaControl = (action: MediaAction) => safe(() => native?.sendMediaKey(action) ?? false, false);

// Music has played at some point since Spotter opened, so pausing it keeps the controls
// up (there'd be no way to press play again otherwise).
let heard = false;

const POLL_MS = 1000;
// After a press, the player takes a moment to start or stop; trust the press until then.
const SETTLE_MS = 1500;

// Whether music is playing, checked every second while the calling screen is mounted.
// `heard` is true once anything has played since Spotter opened.
export function useMusic(): { playing: boolean; heard: boolean; press: (action: MediaAction) => void } {
  const [playing, setPlaying] = useState(isMusicActive);
  const [wasHeard, setWasHeard] = useState(heard || playing);
  const pressedAt = useRef(0);

  useEffect(() => {
    if (!native) return;
    const check = () => {
      if (Date.now() - pressedAt.current < SETTLE_MS) return;
      const now = isMusicActive();
      setPlaying(now);
      if (now && !heard) {
        heard = true;
        setWasHeard(true);
      }
    };
    check();
    const t = setInterval(check, POLL_MS);
    const app = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      clearInterval(t);
      app.remove();
    };
  }, []);

  const press = (action: MediaAction) => {
    if (!mediaControl(action)) return;
    pressedAt.current = Date.now();
    if (action === 'toggle') setPlaying((p) => !p);
    if (action === 'play' || action === 'next' || action === 'previous') setPlaying(true);
    if (action === 'pause') setPlaying(false);
  };

  return { playing, heard: wasHeard, press };
}

// ---------- Focus mode (Do Not Disturb) ----------

// Android's NotificationManager.INTERRUPTION_FILTER_* values.
export const DND_OFF = 1; // ALL: everything comes through
export const DND_PRIORITY = 2; // priority only (alarms included)

export const dndSupported = native != null;
export const hasDndAccess = () => safe(() => native?.hasDndAccess() ?? false, false);
export const openDndSettings = () => safe(() => native?.openDndSettings() ?? false, false);
export const getDnd = () => safe(() => native?.getInterruptionFilter() ?? 0, 0);
export const setDnd = (filter: number) => safe(() => native?.setInterruptionFilter(filter) ?? false, false);
