import type { Exercise, Muscle } from '@/db/types';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const muscleLabel = (m: Muscle) => capitalize(m);

// "Chest · Barbell". Custom exercises say so, since they have no demo.
export const exerciseMeta = (e: Exercise) =>
  `${muscleLabel(e.muscle)} · ${e.isCustom ? 'Custom' : capitalize(e.equipment)}`;
