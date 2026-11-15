import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { colors } from '@/theme';

// The workout on the lock screen: one quiet notification that stays while a session is
// open. It says which set is next (or when rest ends) and has a Log set button, so a set
// can be ticked without unlocking the phone. It never makes a sound or buzzes; the rest
// alert (restAlert.ts) is what tells you rest is over.

export const LIVE_ID = 'workout-live';
const CHANNEL = 'workout';
const CATEGORY = { set: 'workout-set', rest: 'workout-rest', restOnly: 'workout-rest-only' } as const;
export type LiveAction = 'log' | 'skip';

export type LiveState = {
  title: string; // "Leg Press · set 3 of 4"
  body: string; // "60 kg × 8", or "Rest until 14:32 · then 60 kg × 8"
  canLog: boolean; // the set has numbers to log
  resting: boolean;
};

let ready: Promise<void> | null = null;

// The channel and the button sets, once per launch.
function prepare(): Promise<void> {
  ready ??= (async () => {
    if (Platform.OS === 'android') {
      // Default importance, not low: Android hides silent notifications from the lock
      // screen on many phones, and the lock screen is the point. No sound, no buzz.
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Workout in progress',
        description: 'The next set on your lock screen while a session is open.',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        enableVibrate: false,
        vibrationPattern: null,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: false,
      });
    }
    const log = { identifier: 'log', buttonTitle: 'Log set', options: { opensAppToForeground: false } };
    const skip = { identifier: 'skip', buttonTitle: 'Skip rest', options: { opensAppToForeground: false } };
    await Notifications.setNotificationCategoryAsync(CATEGORY.set, [log]);
    await Notifications.setNotificationCategoryAsync(CATEGORY.rest, [skip, log]);
    await Notifications.setNotificationCategoryAsync(CATEGORY.restOnly, [skip]);
  })().catch(() => {
    ready = null; // try again next time
  });
  return ready;
}

// Updates come quickly (every edit to a set's numbers), so they run in order and the
// last one wins; one that says the same thing as the last is skipped.
let chain: Promise<unknown> = Promise.resolve();
let shown = '';
const inOrder = (task: () => Promise<unknown>) => {
  chain = chain.then(task).catch(() => {});
  return chain;
};

export function showLiveWorkout(state: LiveState) {
  const key = JSON.stringify(state);
  return inOrder(async () => {
    if (key === shown) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await prepare();
    const category = state.resting
      ? state.canLog
        ? CATEGORY.rest
        : CATEGORY.restOnly
      : state.canLog
        ? CATEGORY.set
        : undefined;
    await Notifications.scheduleNotificationAsync({
      identifier: LIVE_ID,
      content: {
        title: state.title,
        body: state.body,
        sound: false,
        color: colors.spotterRed,
        sticky: true, // stays until the session ends
        autoDismiss: false,
        ...(category ? { categoryIdentifier: category } : {}),
      },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
    });
    shown = key;
  });
}

export function clearLiveWorkout() {
  return inOrder(async () => {
    shown = '';
    await Notifications.dismissNotificationAsync(LIVE_ID).catch(() => {});
  });
}

// Log set / Skip rest pressed on the notification. Returns the unsubscribe.
export function onLiveAction(handler: (action: LiveAction) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (response.notification.request.identifier !== LIVE_ID) return;
    const action = response.actionIdentifier;
    if (action === 'log' || action === 'skip') handler(action);
  });
  return () => sub.remove();
}

// "14:32", in the phone's own clock style.
export function clockTime(at: number) {
  try {
    return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    const d = new Date(at);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

// A session left open when the app was closed for good leaves its notification behind.
// The workout screen puts it back if the session is resumed.
inOrder(() => Notifications.dismissNotificationAsync(LIVE_ID));
