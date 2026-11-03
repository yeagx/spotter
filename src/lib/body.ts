import type { Checkin } from '@/db/checkins';
import type { Sex } from '@/db/profile';

// Body stats shown as cards on Body, each against the range a body-composition scale
// calls normal for adults of that sex. Without age these are broad adult ranges, so
// the card reads as a guide, never a verdict.
//   Body fat: Gallagher et al. 2000 healthy ranges, ages 20–59 merged.
//   Muscle: skeletal muscle %, Omron body-composition "normal" bands.
//   Water: total body water %, common scale guidance.
//   Bone: Tanita average bone mass for the sex and body weight, ±0.3 kg ("typical").
export type StatKey = 'fat' | 'muscle' | 'water' | 'bone';

export type StatDef = { key: StatKey; label: string; unit: '%' | 'weight' };

export const STATS: StatDef[] = [
  { key: 'fat', label: 'Body fat', unit: '%' },
  { key: 'muscle', label: 'Muscle', unit: '%' },
  { key: 'water', label: 'Water', unit: '%' },
  { key: 'bone', label: 'Bone', unit: 'weight' },
];

const PERCENT_RANGES: Record<Exclude<StatKey, 'bone'>, Record<Sex, [number, number]>> = {
  fat: { male: [8, 21], female: [21, 33] },
  muscle: { male: [33, 39], female: [24, 30] },
  water: { male: [50, 65], female: [45, 60] },
};

function boneAverage(sex: Sex, weightKg: number) {
  if (sex === 'male') return weightKg < 65 ? 2.66 : weightKg <= 95 ? 3.29 : 3.69;
  return weightKg < 50 ? 1.95 : weightKg <= 75 ? 2.4 : 2.95;
}

export type Range = { lo: number; hi: number; word: 'normal' | 'typical' };

// The range for a stat, or null when sex isn't set (no honest range to show).
export function rangeFor(key: StatKey, sex: Sex | null, weightKg: number): Range | null {
  if (!sex) return null;
  if (key === 'bone') {
    const avg = boneAverage(sex, weightKg);
    return { lo: avg - 0.3, hi: avg + 0.3, word: 'typical' };
  }
  const [lo, hi] = PERCENT_RANGES[key][sex];
  return { lo, hi, word: 'normal' };
}

// The bar puts the range in the middle half, so being below or above it reads at a
// glance. Values past either end sit at the edge, and the words say which side.
export function barScale({ lo, hi }: Range): [number, number] {
  const pad = hi - lo;
  return [Math.max(0, lo - pad), hi + pad];
}

export const positionOn = (v: number, [lo, hi]: [number, number]) =>
  Math.min(1, Math.max(0, (v - lo) / (hi - lo)));

export type Standing = 'below' | 'in' | 'above';

export const standing = (v: number, r: Range): Standing => (v < r.lo ? 'below' : v > r.hi ? 'above' : 'in');

// Sanity limits for typed check-in values, to catch slips like 7.29 for 72.9.
// Weights are kg.
export const LIMITS: Record<keyof Omit<Checkin, 'id' | 'date'>, [number, number]> = {
  weight: [20, 350],
  bmi: [10, 70],
  fat: [2, 70],
  muscle: [10, 70],
  water: [20, 80],
  bone: [0.5, 6],
  bmr: [500, 5000],
};

export const inLimits = (key: keyof typeof LIMITS, v: number) =>
  v >= LIMITS[key][0] && v <= LIMITS[key][1];
