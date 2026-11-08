import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { AppState, Platform, Vibration } from 'react-native';

import type { RestAlert } from '@/db/profile';
import { colors } from '@/theme';

// Tells you a rest is over when you aren't looking: phone locked, in a pocket, or in
// another app. A notification is scheduled for the exact moment rest ends, so it arrives
// even if Android or iOS has paused the app. With the app open, the screen says it
// itself (a short sound and a tap), and the notification stays out of the way.

const ID = 'rest-end'; // one rest at a time: scheduling again replaces it
const SOUND_FILE = 'rest_done.wav'; // bundled by the expo-notifications plugin (app.json)
// Two firm buzzes, long enough to feel through a pocket (the first version's short taps
// felt like ordinary haptics). Android fixes a channel's vibration when it's created, so
// a stronger pattern needs new channel ids; the old ones are deleted.
const VIBRATION = [0, 450, 200, 450];
const CHANNEL: Record<Exclude<RestAlert, 'off'>, string> = { sound: 'rest-alert', vibrate: 'rest-alert-quiet' };
const OLD_CHANNELS = ['rest', 'rest-quiet'];

// While the app is open, rest notifications never pop over it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let channels: Promise<void> | null = null;

// Creates the Android channels (sound / vibrate only) once per launch.
function ensureChannels(): Promise<void> {
  channels ??= (async () => {
    if (Platform.OS !== 'android') return;
    for (const old of OLD_CHANNELS) await Notifications.deleteNotificationChannelAsync(old).catch(() => {});
    // A channel's sound and vibration can't change once created, hence two channels.
    await Notifications.setNotificationChannelAsync(CHANNEL.sound, {
      name: 'Rest timer',
      description: 'When a rest is over.',
      importance: Notifications.AndroidImportance.HIGH,
      sound: SOUND_FILE,
      enableVibrate: true,
      vibrationPattern: VIBRATION,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: false,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL.vibrate, {
      name: 'Rest timer, vibrate only',
      description: 'When a rest is over, without a sound.',
      importance: Notifications.AndroidImportance.HIGH,
      sound: null,
      enableVibrate: true,
      vibrationPattern: VIBRATION,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: false,
    });
  })().catch(() => {
    channels = null; // try again next time
  });
  return channels;
}

// Makes sure rest alerts can reach a locked phone: channels exist and notifications are
// allowed, asking once if they haven't been decided yet. Called as a workout starts, so
// the system prompt shows up when it makes sense. Checked every time (never cached), so
// turning notifications on in Settings works without restarting the app.
export async function prepareRestAlerts(): Promise<boolean> {
  try {
    await ensureChannels();
    const now = await Notifications.getPermissionsAsync();
    if (now.granted) return true;
    if (!now.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return asked.granted;
  } catch {
    return false;
  }
}

// Whether notifications are allowed, without asking. Profile shows a way to Settings
// when they aren't, since then a locked phone stays quiet.
export async function restAlertsAllowed(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return true; // can't tell; don't nag
  }
}

// Scheduling is async, and rests start, grow (+15 s) and get skipped quickly, so every
// call runs in order on one chain: the last call always wins.
let chain: Promise<unknown> = Promise.resolve();
const inOrder = (task: () => Promise<unknown>) => {
  chain = chain.then(task).catch(() => {});
  return chain;
};

let pendingAt: number | null = null; // when the scheduled rest ends, if one is

// Schedules the alert for `at` (epoch ms). `body` says what's next, e.g. "Leg Press · set 3".
export function scheduleRestEnd(at: number, mode: RestAlert, body: string) {
  return inOrder(async () => {
    await clear();
    if (mode === 'off' || at - Date.now() < 1000) return;
    if (!(await prepareRestAlerts())) return;
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: {
        title: 'rest’s up.',
        body,
        sound: mode === 'sound' ? SOUND_FILE : false,
        vibrate: VIBRATION,
        color: colors.spotterRed,
        priority: Notifications.AndroidNotificationPriority.MAX,
        autoDismiss: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: CHANNEL[mode],
        // Android's alarm-clock delivery: on time even with the screen off. The ordinary
        // exact alarm is held back by minutes on some phones' battery savers (OnePlus
        // among them), which is why a locked phone stayed quiet. Shows a small alarm
        // icon in the status bar while a rest is running.
        delivery: 'alarmClock',
      },
    });
    pendingAt = at;
  });
}

// The rest was skipped, or the workout ended: take the alert back, delivered or not.
export function cancelRestEnd() {
  return inOrder(clear);
}

async function clear() {
  pendingAt = null;
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
  await Notifications.dismissNotificationAsync(ID).catch(() => {});
}

// Back in the app after the alert went off: the notification has done its job.
AppState.addEventListener('change', (state) => {
  if (state === 'active' && pendingAt !== null && Date.now() >= pendingAt) cancelRestEnd();
});

let player: AudioPlayer | null = null;

// Rest ran out while the app is on screen: a short sound (if chosen) and two real buzzes,
// the same as the notification (a haptic tap alone was too faint to notice mid-set).
// Plays alongside music instead of pausing it, and stays quiet on a muted iPhone.
export function playRestDone(mode: RestAlert) {
  if (AppState.currentState !== 'active') return; // the notification covers it
  if (mode === 'off') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return;
  }
  Vibration.vibrate(VIBRATION);
  if (mode !== 'sound') return;
  try {
    if (!player) {
      setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
      player = createAudioPlayer(require('../../assets/sounds/rest_done.wav'));
    }
    const p = player;
    p.seekTo(0)
      .then(() => p.play())
      .catch(() => {});
  } catch {
    // A sound that can't play is never worth an error; the tap still lands.
  }
}
