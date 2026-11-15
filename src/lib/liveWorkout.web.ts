// Web preview stand-in: a browser tab has no lock screen, so the live workout
// notification is a no-op there. The phone version is liveWorkout.ts.
export const LIVE_ID = 'workout-live';
export type LiveAction = 'log' | 'skip';
export type LiveState = { title: string; body: string; canLog: boolean; resting: boolean };

export const showLiveWorkout = async (_state: LiveState) => {};
export const clearLiveWorkout = async () => {};
export const onLiveAction = (_handler: (action: LiveAction) => void) => () => {};
export const clockTime = (at: number) => {
  const d = new Date(at);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};
