import { requireOptionalNativeModule } from 'expo';
import { useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

// Bridge to modules/spotter-media. On Android: music controls sent as media-button
// presses to whichever app is playing, whether music is playing at all, and Do Not
// Disturb for Focus mode, none of it needing special access. On iPhone: the same music
// controls for Apple Music (the only player iOS lets another app control); no Do Not
// Disturb (Focus mode there runs Shortcuts, lib/focus.ios.ts). On web, Expo Go or a build
// without the module, it's absent and everything here reports "not available".

export type MediaAction = 'play' | 'pause' | 'toggle' | 'next' | 'previous';

type Native = {
  isMusicActive(): boolean;
  canHearLevels?(): boolean;
  startLevels?(): boolean;
  stopLevels?(): boolean;
  addListener?(event: 'onLevels', listener: (e: { levels: number[] }) => void): { remove(): void };
  sendMediaKey(action: MediaAction): boolean;
  hasDndAccess(): boolean;
  openDndSettings(): boolean;
  getInterruptionFilter(): number;
  setInterruptionFilter(filter: number): boolean;
};

const native = Platform.OS === 'web' ? null : requireOptionalNativeModule<Native>('SpotterMedia');

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

// ---------- Music ----------

// This build can control music (any player on Android, Apple Music on iPhone).
export const mediaSupported = native != null;

// What the controls reach, as the strip and the setting name it.
export const musicSource = Platform.OS === 'ios' ? 'Apple Music' : 'Music';
export const musicHint =
  Platform.OS === 'ios'
    ? 'Play, pause and skip Apple Music from the workout screen, once it’s playing. iPhone doesn’t let one app control another’s music, so Spotify and YouTube aren’t included.'
    : 'Play, pause and skip whatever’s playing (Spotify, YouTube, any player) from the workout screen, once music starts.';

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

// ---------- Live waves (Android) ----------

// The music strip's bars can follow the real sound on Android: the native side reads the
// playing sound's loudness in three bands (bass, mids, treble). Android only allows that
// with the Record audio permission, so it's opt-in. iPhone gives no app another app's
// sound at all, so there the bars keep their rhythm loop.
export const levelsSupported = Platform.OS === 'android' && typeof native?.startLevels === 'function';

export const WAVES_ASK = {
  title: 'Waves that follow your music',
  message:
    'The bars can move with the song itself. Android only lets an app read what’s playing with the Record audio permission. Spotter records and keeps nothing: it only reads how loud the bass, mids and treble are, to draw three bars.',
};

export const canHearLevels = () => safe(() => native?.canHearLevels?.() ?? false, false);

export async function allowLevels(): Promise<boolean> {
  if (!levelsSupported) return false;
  try {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return r === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// Calls `onLevels` with three 0..1 levels about 20 times a second while it's subscribed.
// Returns the unsubscribe, or null when it can't run (no permission, or the phone refuses).
export function listenToLevels(onLevels: (levels: number[]) => void): (() => void) | null {
  if (!levelsSupported || !canHearLevels()) return null;
  const sub = safe(() => native?.addListener?.('onLevels', (e) => onLevels(e.levels)) ?? null, null);
  if (!sub) return null;
  if (!safe(() => native?.startLevels?.() ?? false, false)) {
    sub.remove();
    return null;
  }
  return () => {
    sub.remove();
    safe(() => native?.stopLevels?.(), false);
  };
}

// ---------- Focus mode (Do Not Disturb) ----------

// Android's NotificationManager.INTERRUPTION_FILTER_* values.
export const DND_OFF = 1; // ALL: everything comes through
export const DND_PRIORITY = 2; // priority only (alarms included)

export const dndSupported = Platform.OS === 'android' && native != null;
export const hasDndAccess = () => safe(() => native?.hasDndAccess() ?? false, false);
export const openDndSettings = () => safe(() => native?.openDndSettings() ?? false, false);
export const getDnd = () => safe(() => native?.getInterruptionFilter() ?? 0, 0);
export const setDnd = (filter: number) => safe(() => native?.setInterruptionFilter(filter) ?? false, false);
