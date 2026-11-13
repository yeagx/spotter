// How a logged set reads, by what its exercise tracks (see Tracking in db/types).

import type { Lift } from '@/db/sessions';
import type { Tracking } from '@/db/types';
import { formatNumber } from '@/lib/units';

// What useUnits() gives: enough to show weight and distance in the user's units.
export type UnitsView = {
  units: string;
  show: (kg: number) => string;
  dist: string;
  showDist: (m: number) => string;
};

export const TRACKING_LABELS: Record<Tracking, string> = {
  weight: 'Weight × reps',
  reps: 'Reps only',
  time: 'Time',
  cardio: 'Time + distance',
};

// A custom exercise starts with what its muscle group usually means.
export const defaultTracking = (muscle: string): Tracking => (muscle === 'cardio' ? 'cardio' : 'weight');

// "45 s" under a minute, "1:30" from there.
export function formatSeconds(sec: number) {
  if (sec < 60) return `${sec} s`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export const formatMinutes = (sec: number) => `${formatNumber(sec / 60)} min`;

// One set in full: "60 kg × 8", "12 reps", "45 s", "20 min · 3.1 km".
// `compact` drops the units that are obvious in a list of sets: "60 × 8", "12".
export function formatLift(l: Lift, tracking: Tracking, u: UnitsView, compact = false): string {
  switch (tracking) {
    case 'reps':
      return compact ? `${l.reps}` : `${l.reps} reps`;
    case 'time':
      return formatSeconds(l.sec);
    case 'cardio':
      return l.m > 0 ? `${formatMinutes(l.sec)} · ${u.showDist(l.m)} ${u.dist}` : formatMinutes(l.sec);
    default:
      if (l.kg === 0) return compact ? `${l.reps}` : `${l.reps} reps`;
      return compact ? `${u.show(l.kg)} × ${l.reps}` : `${u.show(l.kg)} ${u.units} × ${l.reps}`;
  }
}

// The one number a trend follows, and what it's counted in. Weight moves done without
// weight follow reps; cardio follows distance once any is logged, else time.
export function trendMetric(
  tracking: Tracking,
  history: Lift[],
  u: UnitsView & { fromKg: (kg: number) => number; fromM: (m: number) => number },
): { value: (l: Lift) => number; unit: string; show: (l: Lift) => string } {
  switch (tracking) {
    case 'reps':
      return { value: (l) => l.reps, unit: 'reps', show: (l) => `${l.reps}` };
    case 'time':
      return { value: (l) => l.sec, unit: 's', show: (l) => `${l.sec}` };
    case 'cardio':
      return history.some((l) => l.m > 0)
        ? { value: (l) => u.fromM(l.m), unit: u.dist, show: (l) => u.showDist(l.m) }
        : { value: (l) => l.sec / 60, unit: 'min', show: (l) => formatNumber(l.sec / 60) };
    default:
      return history.length > 0 && history.every((l) => l.kg === 0)
        ? { value: (l) => l.reps, unit: 'reps', show: (l) => `${l.reps}` }
        : { value: (l) => u.fromKg(l.kg), unit: u.units, show: (l) => u.show(l.kg) };
  }
}
