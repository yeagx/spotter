import type { Targets } from './types';

// What each library exercise works, curated by hand. free-exercise-db lists muscles too,
// but too coarsely to be useful here (one "shoulders" for front, side and rear delts;
// one "chest" for flat and incline), so these are written out per exercise.
//
// primary: what the exercise is for. secondary: what helps or holds steady.
// Plain gym names, not anatomy: "Side delts", "Upper back", "Quads".
// Seeded into exercise.targets_json with the library (bump LIBRARY_VERSION on change).

const t = (primary: string[], secondary: string[] = []): Targets => ({ primary, secondary });

export const TARGETS: Record<string, Targets> = {
  // Chest
  'barbell-bench-press': t(['Chest'], ['Front delts', 'Triceps']),
  'incline-barbell-press': t(['Upper chest'], ['Front delts', 'Triceps']),
  'flat-dumbbell-press': t(['Chest'], ['Front delts', 'Triceps']),
  'incline-dumbbell-press': t(['Upper chest'], ['Front delts', 'Triceps']),
  'machine-chest-press': t(['Chest'], ['Front delts', 'Triceps']),
  'cable-fly': t(['Chest'], ['Front delts']),
  'push-up': t(['Chest'], ['Front delts', 'Triceps', 'Core']),

  // Back
  'lat-pulldown': t(['Lats'], ['Upper back', 'Biceps', 'Rear delts']),
  'close-grip-lat-pulldown': t(['Lats'], ['Upper back', 'Biceps']),
  'seated-cable-row': t(['Upper back', 'Lats'], ['Rear delts', 'Biceps']),
  'barbell-row': t(['Upper back', 'Lats'], ['Rear delts', 'Biceps', 'Lower back']),
  'dumbbell-row': t(['Lats', 'Upper back'], ['Rear delts', 'Biceps']),
  'machine-row': t(['Upper back', 'Lats'], ['Rear delts', 'Biceps']),
  'pull-up': t(['Lats'], ['Upper back', 'Biceps', 'Core']),
  'straight-arm-pulldown': t(['Lats'], ['Triceps', 'Core']),
  'back-extension': t(['Lower back'], ['Glutes', 'Hamstrings']),

  // Shoulders
  'overhead-press': t(['Front delts'], ['Side delts', 'Triceps', 'Core']),
  'dumbbell-shoulder-press': t(['Front delts'], ['Side delts', 'Triceps']),
  'dumbbell-lateral-raise': t(['Side delts'], ['Traps']),
  'cable-lateral-raise': t(['Side delts'], ['Traps']),
  'rear-delt-fly': t(['Rear delts'], ['Upper back']),
  'face-pull': t(['Rear delts'], ['Upper back', 'Traps']),

  // Biceps
  'barbell-curl': t(['Biceps'], ['Forearms']),
  'dumbbell-curl': t(['Biceps'], ['Forearms']),
  'hammer-curl': t(['Brachialis', 'Forearms'], ['Biceps']),
  'incline-dumbbell-curl': t(['Biceps long head'], ['Forearms']),
  'cable-curl': t(['Biceps'], ['Forearms']),

  // Triceps
  'triceps-pushdown': t(['Triceps']),
  'rope-pushdown': t(['Triceps']),
  'overhead-dumbbell-extension': t(['Triceps long head']),
  'skull-crusher': t(['Triceps']),
  dip: t(['Triceps', 'Lower chest'], ['Front delts']),

  // Legs
  'leg-press': t(['Quads', 'Glutes'], ['Hamstrings', 'Adductors']),
  'barbell-squat': t(['Quads', 'Glutes'], ['Adductors', 'Hamstrings', 'Lower back', 'Core']),
  'goblet-squat': t(['Quads', 'Glutes'], ['Adductors', 'Core']),
  'hack-squat': t(['Quads'], ['Glutes']),
  'walking-lunge': t(['Quads', 'Glutes'], ['Hamstrings', 'Adductors']),
  'bulgarian-split-squat': t(['Quads', 'Glutes'], ['Adductors', 'Hamstrings']),
  'romanian-deadlift': t(['Hamstrings', 'Glutes'], ['Lower back']),
  'seated-leg-curl': t(['Hamstrings'], ['Calves']),
  'lying-leg-curl': t(['Hamstrings'], ['Calves']),
  'leg-extension': t(['Quads']),
  'hip-thrust': t(['Glutes'], ['Hamstrings']),

  // Calves
  'standing-calf-raise': t(['Calves']),
  'seated-calf-raise': t(['Calves (lower)']),

  // Core
  plank: t(['Abs'], ['Obliques', 'Glutes']),
  'hanging-leg-raise': t(['Abs', 'Hip flexors'], ['Obliques', 'Forearms']),
  'cable-crunch': t(['Abs'], ['Obliques']),
  'russian-twist': t(['Obliques'], ['Abs']),
  'ab-wheel': t(['Abs'], ['Lats', 'Obliques']),
  'dead-bug': t(['Abs'], ['Hip flexors']),

  // Cardio
  'treadmill-walk': t(['Heart and lungs'], ['Calves', 'Glutes']),
  'treadmill-run': t(['Heart and lungs'], ['Quads', 'Hamstrings', 'Calves']),
  'stationary-bike': t(['Heart and lungs'], ['Quads', 'Glutes']),
  'rowing-machine': t(['Heart and lungs'], ['Quads', 'Glutes', 'Upper back']),
};
