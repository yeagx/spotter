import * as Haptics from 'expo-haptics';

// The app's small vocabulary of taps. Each is fire-and-forget: a phone with no haptic
// motor (or the web preview) simply stays quiet.
//
//   select  choosing between options: a chip, a segment, a tab
//   press   committing to something: the primary button, ticking a set
//   success a moment worth marking: a new best
//   warn    something needs fixing before it can go on

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
};

export type HapticKind = keyof typeof haptic;
