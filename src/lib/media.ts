import { requireOptionalNativeModule } from 'expo';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

// Bridge to modules/spotter-media (Android): what another app is playing, its controls,
// and Do Not Disturb for Focus mode. On web, iOS, Expo Go or an APK built before the
// module existed, it's simply absent and everything here reports "not available".

export type NowPlaying = {
  packageName: string;
  appName: string; // "Spotify", or '' if Android won't say
  title: string;
  artist: string;
  artwork: string | null; // small JPEG data URI
  durationMs: number; // 0 when unknown (a live stream)
  positionMs: number; // as of positionAt
  positionAt: number; // epoch ms
  speed: number;
  playing: boolean;
  canSeek: boolean;
  canNext: boolean;
  canPrevious: boolean;
};

export type MediaAction = 'play' | 'pause' | 'toggle' | 'next' | 'previous' | 'seek';

type ChangeEvent = { nowPlaying: NowPlaying | null; access: boolean };

type Native = {
  hasMediaAccess(): boolean;
  openMediaAccessSettings(): boolean;
  getNowPlaying(): NowPlaying | null;
  control(action: MediaAction, value: number | null): boolean;
  openPlayer(): boolean;
  hasDndAccess(): boolean;
  openDndSettings(): boolean;
  getInterruptionFilter(): number;
  setInterruptionFilter(filter: number): boolean;
  addListener(event: 'onChange', listener: (e: ChangeEvent) => void): { remove(): void };
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('SpotterMedia') : null;

// This build can show and control other apps' music.
export const mediaSupported = native != null;

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const hasMediaAccess = () => safe(() => native?.hasMediaAccess() ?? false, false);
export const openMediaAccessSettings = () => safe(() => native?.openMediaAccessSettings() ?? false, false);
export const mediaControl = (action: MediaAction, value: number | null = null) =>
  safe(() => native?.control(action, value) ?? false, false);
export const openPlayer = () => safe(() => native?.openPlayer() ?? false, false);

// What's playing right now, kept up to date while the calling screen is mounted.
// `access` is false until Notification access is on.
export function useNowPlaying(): { nowPlaying: NowPlaying | null; access: boolean } {
  const [state, setState] = useState<ChangeEvent>(() => ({
    nowPlaying: safe(() => native?.getNowPlaying() ?? null, null),
    access: hasMediaAccess(),
  }));

  useEffect(() => {
    if (!native) return;
    const sub = safe(() => native.addListener('onChange', setState), null);
    // Access can be switched on in Settings while Spotter waits in the background.
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') setState({ nowPlaying: safe(() => native.getNowPlaying(), null), access: hasMediaAccess() });
    });
    return () => {
      sub?.remove();
      app.remove();
    };
  }, []);

  return state;
}

// Where the track is now, running on from the last report while it plays.
export function positionNow(p: NowPlaying, now = Date.now()): number {
  const pos = p.playing ? p.positionMs + (now - p.positionAt) * p.speed : p.positionMs;
  return p.durationMs > 0 ? Math.min(Math.max(0, pos), p.durationMs) : Math.max(0, pos);
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
