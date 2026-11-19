import { requireOptionalNativeModule } from 'expo';
import type { LiveActivity, LiveActivityFactory } from 'expo-widgets';

import type { WorkoutActivityProps } from '@/widgets/ios/workoutActivity';

import * as notice from './liveWorkoutNotice';
import type { LiveAction, LiveState } from './liveWorkoutNotice';

export { LIVE_ID, clockTime } from './liveWorkoutNotice';
export type { LiveAction, LiveState } from './liveWorkoutNotice';

// The workout on the iPhone's lock screen: a Live Activity (lock screen and Dynamic
// Island), with a live rest countdown and Log set / Skip rest. It does what Android's
// notification does (liveWorkoutNotice.ts), which stays as the fallback when Live
// Activities are switched off for Spotter or the build doesn't have them.

const NAME = 'Workout'; // the name its button events come back with

let factory: LiveActivityFactory<WorkoutActivityProps> | null | undefined;

function activities() {
  if (factory !== undefined) return factory;
  factory = null;
  try {
    if (requireOptionalNativeModule('ExpoWidgets')) {
      const { createLiveActivity } = require('expo-widgets') as typeof import('expo-widgets');
      const { WorkoutActivity } = require('@/widgets/ios/workoutActivity') as typeof import('@/widgets/ios/workoutActivity');
      factory = createLiveActivity<WorkoutActivityProps>(NAME, WorkoutActivity as never);
    }
  } catch {
    factory = null;
  }
  return factory;
}

function toProps(s: LiveState): WorkoutActivityProps {
  const { workoutActivityTheme } = require('@/widgets/ios/workoutActivity') as typeof import('@/widgets/ios/workoutActivity');
  return {
    t: workoutActivityTheme(),
    set: s.set ?? s.title,
    exercise: s.exercise ?? s.body,
    what: s.what ?? '',
    restFrom: s.resting ? (s.restFrom ?? null) : null,
    restUntil: s.resting ? (s.restUntil ?? null) : null,
    canLog: s.canLog,
  };
}

// In order, last one wins, the same as the notification.
let chain: Promise<unknown> = Promise.resolve();
const inOrder = (task: () => Promise<unknown>) => {
  chain = chain.then(task).catch(() => {});
  return chain;
};

let current: LiveActivity<WorkoutActivityProps> | null = null;
let shown = '';

export function showLiveWorkout(state: LiveState) {
  const key = JSON.stringify(state);
  return inOrder(async () => {
    if (key === shown) return;
    const f = activities();
    if (f) {
      try {
        const props = toProps(state);
        // Stale at the end of a rest: iOS redraws it then, saying the rest is over, even
        // if Spotter is asleep by that time.
        const stale = props.restUntil ? new Date(props.restUntil) : undefined;
        current ??= f.getInstances()[0] ?? null; // one left from before a restart
        if (current) await current.update(props, stale);
        else current = f.start(props, undefined, stale);
        shown = key;
        return;
      } catch {
        // Live Activities off for Spotter (Settings → Spotter), or not allowed right now
        // (they can only start with the app on screen): the notification does the job.
        current = null;
      }
    }
    await notice.showLiveWorkout(state);
    shown = key;
  });
}

export function clearLiveWorkout() {
  return inOrder(async () => {
    shown = '';
    const f = activities();
    const all = f ? f.getInstances() : [];
    current = null;
    for (const a of all) await a.end('immediate').catch(() => {});
    await notice.clearLiveWorkout();
  });
}

// Log set / Skip rest, from the Live Activity or the fallback notification.
export function onLiveAction(handler: (action: LiveAction) => void): () => void {
  const off = notice.onLiveAction(handler);
  let sub: { remove: () => void } | null = null;
  if (activities()) {
    const { addUserInteractionListener } = require('expo-widgets') as typeof import('expo-widgets');
    sub = addUserInteractionListener((e) => {
      if (e.source === NAME && (e.target === 'log' || e.target === 'skip')) handler(e.target);
    });
  }
  return () => {
    off();
    sub?.remove();
  };
}
