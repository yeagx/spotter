import { Linking } from 'react-native';

// Focus mode on iPhone. No app may switch Focus or Do Not Disturb there, but Shortcuts
// can, and Spotter can run a shortcut. So the user adds two once, and Spotter runs them
// as a session starts and ends. Shortcuts comes to the front for a moment, then hands
// back to Spotter through the x-success link (handled in src/app/+native-intent.tsx,
// which keeps you on the screen you were on).

export const SHORTCUT_ON = 'Spotter Focus On';
export const SHORTCUT_OFF = 'Spotter Focus Off';

// The link a finished (or failed) shortcut opens to bring Spotter back.
export const FOCUS_BACK = 'focus-back';

const back = (error: boolean) => encodeURIComponent(`spotter://${FOCUS_BACK}${error ? '?error=1' : ''}`);

export function runShortcut(name: string): Promise<boolean> {
  const url =
    `shortcuts://x-callback-url/run-shortcut?name=${encodeURIComponent(name)}` +
    `&x-success=${back(false)}&x-cancel=${back(false)}&x-error=${back(true)}`;
  return Linking.openURL(url).then(
    () => true,
    () => false,
  );
}

// A new, empty shortcut, to make the two in.
export const openShortcuts = () => Linking.openURL('shortcuts://create-shortcut').catch(() => {});

export const SETUP_TITLE = 'Set up Focus mode';
export const SETUP_STEPS =
  'iPhone doesn’t let apps switch Focus, so Spotter runs two shortcuts you add once.\n\n' +
  `1. In Shortcuts, make a shortcut with the action Set Focus: pick a Focus (Do Not Disturb works) and Turn On. Name it “${SHORTCUT_ON}”.\n` +
  `2. Make a second that turns it Off. Name it “${SHORTCUT_OFF}”.\n` +
  '3. In Settings → Focus → that Focus → Apps, add Spotter, so your rest timer still comes through.\n\n' +
  'As a session starts and ends, Shortcuts opens for a second and comes straight back.';
