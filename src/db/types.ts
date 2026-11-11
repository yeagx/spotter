// Muscle groups in the order the library filter shows them.
export const MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'legs',
  'calves',
  'core',
  'cardio',
] as const;
export type Muscle = (typeof MUSCLES)[number];

// ISO weekday, matching split_day.weekday: 1 = Monday ... 7 = Sunday.
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other';

// What the demo player shows. `key` points into a bundled registry (see exerciseFrames.ts),
// never at a file path, so swapping frames for a filmed clip later is a data change only.
// `file` is a photo, GIF or short clip the user attached to their own exercise: `name` is
// a file in the app's documents folder (see lib/exerciseMedia), never a full path, since
// the folder's location can change between installs.
export type ExerciseMedia =
  | { type: 'frames'; key: string }
  | { type: 'video'; key: string }
  | { type: 'file'; kind: 'image' | 'video'; name: string };

// What an exercise works. primary: what it's for; secondary: what helps or holds steady.
export type Targets = { primary: string[]; secondary: string[] };

export type Exercise = {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  cues: string[];
  media: ExerciseMedia | null; // null for a custom exercise with nothing attached
  targets: Targets | null; // null for custom exercises: only their muscle group is known
  note: string | null; // the user's own reminder, e.g. "seat 4, narrow grip"
  isCustom: boolean;
};
