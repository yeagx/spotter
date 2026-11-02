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

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other';

// What the demo player shows. `key` points into a bundled registry (see exerciseFrames.ts),
// never at a file path, so swapping frames for a filmed clip later is a data change only.
export type ExerciseMedia = { type: 'frames'; key: string } | { type: 'video'; key: string };

export type Exercise = {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  cues: string[];
  media: ExerciseMedia | null; // null for custom exercises: they have no demo
  isCustom: boolean;
};
