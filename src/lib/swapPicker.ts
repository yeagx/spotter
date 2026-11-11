import { router } from 'expo-router';

import type { Exercise } from '@/db/types';

// Swapping an exercise mid-workout opens a full screen, and the workout decides what a
// pick does. Route params only carry strings, so the request is handed over here (the
// same way the library picker works).
export type SwapRequest = {
  current: Exercise; // what's on the workout screen now
  planned: Exercise; // what the plan says; offered first once something else is swapped in
  takenIds: string[]; // already in this session, so not offered
  onPick: (exercise: Exercise) => void | Promise<void>;
};

let pending: SwapRequest | null = null;

export function openSwap(request: SwapRequest) {
  pending = request;
  router.push('/swap');
}

// Read (not consumed, so React's dev double-render is safe) by the swap screen.
// Null after an app reload; the screen just goes back.
export function currentSwapRequest() {
  return pending;
}
