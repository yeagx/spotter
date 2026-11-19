import { notify } from '@/lib/confirm';
import { FOCUS_BACK, SHORTCUT_OFF, SHORTCUT_ON } from '@/lib/focusShortcuts';

// Links into Spotter before Expo Router sees them. The Focus shortcuts (iPhone) hand
// back with spotter://focus-back: that only brings Spotter to the front, so it goes no
// further and you stay on the screen you were on (the workout, usually).
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  if (!path.includes(FOCUS_BACK)) return path;
  if (path.includes('error=1')) {
    setTimeout(
      () =>
        notify(
          'Focus shortcut not found',
          `Shortcuts couldn’t run “${SHORTCUT_ON}” or “${SHORTCUT_OFF}”. Add them (Profile → Focus mode shows how), or turn Focus mode off.`,
        ),
      initial ? 1500 : 0,
    );
  }
  return initial ? '/' : null;
}
