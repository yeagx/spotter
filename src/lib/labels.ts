import type { Exercise, Muscle } from '@/db/types';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const muscleLabel = (m: Muscle) => capitalize(m);

// What an exercise works, as two parts of one line: "Quads, Glutes" and "also
// Hamstrings, Adductors". Custom exercises only know their group, e.g. "Legs".
export function targetParts(e: Exercise): { primary: string; secondary: string | null } {
  if (!e.targets) return { primary: muscleLabel(e.muscle), secondary: null };
  return {
    primary: e.targets.primary.join(', '),
    secondary: e.targets.secondary.length ? `also ${e.targets.secondary.join(', ')}` : null,
  };
}

// Everything an exercise can be found by in search: its name and what it works.
export const searchText = (e: Exercise) =>
  [e.name, ...(e.targets ? [...e.targets.primary, ...e.targets.secondary] : [muscleLabel(e.muscle)])].join(' ');

export const equipmentLabel = (e: Exercise) => (e.isCustom ? 'Custom' : capitalize(e.equipment));

// "Chest · Barbell". Custom exercises say so, since they have no demo.
export const exerciseMeta = (e: Exercise) =>
  `${muscleLabel(e.muscle)} · ${e.isCustom ? 'Custom' : capitalize(e.equipment)}`;
