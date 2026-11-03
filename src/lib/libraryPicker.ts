import { router } from 'expo-router';

import type { Exercise } from '@/db/types';

// The library is a full screen, but whoever opens it decides what "Add" does:
// Plan writes the picks straight to the day, Edit day adds them to its unsaved draft.
// Route params can only carry strings, so the request is handed over here instead.
export type LibraryRequest = {
  dayLabel: string; // "Monday", shown as "ADD TO MONDAY"
  existingIds: string[]; // already in the day, shown but not selectable
  onAdd: (exercises: Exercise[]) => void | Promise<void>;
};

let pending: LibraryRequest | null = null;

export function openLibrary(request: LibraryRequest) {
  pending = request;
  router.push('/library');
}

// Read (not consumed, so React's dev double-render is safe) by the library screen.
// Null after an app reload, when there's nothing to add to; the screen just goes back.
export function currentLibraryRequest() {
  return pending;
}
