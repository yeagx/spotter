import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// The app's small vocabulary of taps. Each is fire-and-forget: a phone with no haptic
// motor (or the web preview) simply stays quiet.
//
//   select  choosing between options: a chip, a segment, a tab
//   press   committing to something: the primary button, ticking a set
//   success a moment worth marking: a new best
//   warn    something needs fixing before it can go on
//   focusOn  Focus mode just turned Do Not Disturb on: a crisp click, then a firmer
//            beat, like something locking into place
//   focusOff Do Not Disturb is off again: one soft click

const quiet = () => {};

export const haptic = {
  select: () => {
    Haptics.selectionAsync().catch(quiet);
  },
  press: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(quiet);
  },
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(quiet);
  },
  warn: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(quiet);
  },
  focusOn: () => {
    toggle(Haptics.AndroidHaptics.Toggle_On);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(quiet), FOCUS_BEAT_MS);
  },
  focusOff: () => {
    toggle(Haptics.AndroidHaptics.Toggle_Off);
  },
};

// Gap between the two beats of focusOn: far enough apart to feel as two, close enough
// to feel as one gesture.
const FOCUS_BEAT_MS = 140;

// Android's own switch clicks (the crisp ones its settings toggles use). Elsewhere, or on
// a phone that can't play them, a light tap stands in.
function toggle(kind: Haptics.AndroidHaptics) {
  const fallback = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(quiet);
  if (Platform.OS !== 'android') {
    fallback();
    return;
  }
  Haptics.performAndroidHapticsAsync(kind).catch(fallback);
}

export type HapticKind = keyof typeof haptic;
