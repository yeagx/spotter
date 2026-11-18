import type { SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import { getMeta, setMeta } from '@/db/meta';
import { getDay } from '@/db/plan';
import { getOpenSession } from '@/db/sessions';
import type { LiveAction } from '@/lib/liveWorkout';

// The session that's open, for the Resume bar on every screen. A workout can be left
// mid-session (Back, or the ⌄ in its header) to look at the plan or log a check-in; the
// session keeps running and the bar brings you back to the same set.
//
// What the workout screen needs to pick up where it was (the exercise on screen, a rest
// that's running, numbers typed but not ticked yet) is saved in the meta table, so it
// also survives Android closing the app in the background.

export type Live = {
  id: string; // session id
  dayName: string;
  startedAt: number;
  restEndsAt: number | null;
};

// Unticked numbers typed into a row, by exercise (day_exercise id) and set index.
export type DraftRow = { kg: string; reps: string; time: string; dist: string };

export type WorkoutUi = {
  id: string; // the session this belongs to
  index: number;
  restEndsAt: number | null;
  restTotal: number;
  restingInto: number | null;
  restNote: string;
  drafts: Record<string, (DraftRow | null)[]>;
};

const UI_KEY = 'workout_ui';

let live: Live | null = null;
// True while the workout screen is mounted (on top, or under a screen it opened, like an
// exercise's details). The bar hides then: Back already leads there.
let workoutOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function setLive(next: Live | null) {
  live = next;
  emit();
}

export function patchLive(change: Partial<Live>) {
  if (!live) return;
  live = { ...live, ...change };
  emit();
}

export function setWorkoutOpen(open: boolean) {
  workoutOpen = open;
  emit();
}

export function useLive(): Live | null {
  return useSyncExternalStore(subscribe, () => live);
}

export function useWorkoutOpen(): boolean {
  return useSyncExternalStore(subscribe, () => workoutOpen);
}

// Reads the open session from the database: at launch, so a session left open when the
// app was closed shows its bar straight away.
export async function loadLive(db: SQLiteDatabase): Promise<void> {
  const session = await getOpenSession(db);
  if (!session) {
    setLive(null);
    return;
  }
  const day = session.splitDayId ? await getDay(db, session.splitDayId) : null;
  if (!day) {
    setLive(null);
    return;
  }
  const ui = await loadWorkoutUi(db, session.id);
  setLive({
    id: session.id,
    dayName: day.name,
    startedAt: session.startedAt,
    restEndsAt: ui?.restEndsAt && ui.restEndsAt > Date.now() ? ui.restEndsAt : null,
  });
}

export async function loadWorkoutUi(db: SQLiteDatabase, sessionId: string): Promise<WorkoutUi | null> {
  try {
    const raw = await getMeta(db, UI_KEY);
    if (!raw) return null;
    const ui = JSON.parse(raw) as WorkoutUi;
    return ui.id === sessionId ? ui : null;
  } catch {
    return null;
  }
}

export function saveWorkoutUi(db: SQLiteDatabase, ui: WorkoutUi | null): Promise<void> {
  return setMeta(db, UI_KEY, ui ? JSON.stringify(ui) : '').catch(() => {});
}

// A lock-screen button (Log set / Skip rest) pressed while the workout screen is closed.
// The bar's owner opens the workout, which takes the action once it has loaded.
let pendingAction: LiveAction | null = null;
export const setPendingLiveAction = (a: LiveAction | null) => {
  pendingAction = a;
};
export const takePendingLiveAction = () => {
  const a = pendingAction;
  pendingAction = null;
  return a;
};
