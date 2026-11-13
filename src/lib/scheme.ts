// Formatting and parsing for sets, reps and rest as the user sees and types them.

import type { DayExercise, Scheme, SplitDay } from '@/db/plan';
import type { Tracking } from '@/db/types';
import { formatNumber } from '@/lib/units';

export const SETS_MIN = 1;
export const SETS_MAX = 10;
const REST_MAX_SEC = 60 * 60;

export function formatReps(min: number, max: number) {
  return min === max ? String(min) : `${min}–${max}`;
}

// Accepts "10", "8-12", "8–12", "8 to 12". Reversed ranges are swapped.
export function parseReps(text: string): { min: number; max: number } | null {
  const m = text.trim().match(/^(\d{1,3})(?:\s*(?:-|–|—|to)\s*(\d{1,3}))?$/i);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return min > 0 ? { min, max } : null;
}

export function formatRest(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Accepts "1:30" (m:ss) or a plain number of seconds ("90").
export function parseRest(text: string): number | null {
  const t = text.trim();
  const clock = t.match(/^(\d{1,2}):([0-5]\d)$/);
  const sec = clock ? Number(clock[1]) * 60 + Number(clock[2]) : /^\d{1,4}$/.test(t) ? Number(t) : NaN;
  return Number.isNaN(sec) || sec > REST_MAX_SEC ? null : sec;
}

// The planned target of one set, typed and shown in the exercise's own unit: reps,
// seconds for a hold, whole minutes for cardio.
type Target = Pick<Scheme, 'repsMin' | 'repsMax' | 'secMin' | 'secMax'>;

const minutes = (sec: number) => formatNumber(sec / 60);

// What the target field in Edit day is called.
export const targetLabel = (t: Tracking) => (t === 'time' ? 'Seconds' : t === 'cardio' ? 'Minutes' : 'Reps');

// The target as it's typed: "8–12", "30–60" (seconds), "20" (minutes).
export function targetText(t: Tracking, e: Target) {
  if (t === 'time') return formatReps(e.secMin, e.secMax);
  if (t === 'cardio') return e.secMin === e.secMax ? minutes(e.secMin) : `${minutes(e.secMin)}–${minutes(e.secMax)}`;
  return formatReps(e.repsMin, e.repsMax);
}

// Reads a typed target back. Null if it doesn't parse; only the fields it sets change.
export function parseTarget(t: Tracking, text: string): Partial<Target> | null {
  const range = parseReps(text);
  if (!range) return null;
  if (t === 'time') return { secMin: range.min, secMax: range.max };
  if (t === 'cardio') return { secMin: range.min * 60, secMax: range.max * 60 };
  return { repsMin: range.min, repsMax: range.max };
}

// "8–12 reps", "30–60 s", "20 min".
export function formatTarget(t: Tracking, e: Target) {
  if (t === 'time') return `${formatReps(e.secMin, e.secMax)} s`;
  if (t === 'cardio') return `${targetText(t, e)} min`;
  return `${formatReps(e.repsMin, e.repsMax)} reps`;
}

type Planned = Pick<DayExercise, 'exercise' | 'sets'> & Target;

// Short, for lists: "3 × 8–12", "3 × 30–60 s", and just "20 min" for one block of cardio.
export function formatScheme(e: Planned) {
  const t = e.exercise.tracking;
  if (t === 'cardio' && e.sets === 1) return formatTarget(t, e);
  return `${e.sets} × ${t === 'weight' || t === 'reps' ? formatReps(e.repsMin, e.repsMax) : formatTarget(t, e)}`;
}

// Long, under an exercise's name: "3 sets · 8–12 reps", "20 min".
export function schemeLine(e: Planned) {
  const t = e.exercise.tracking;
  if (t === 'cardio' && e.sets === 1) return formatTarget(t, e);
  return `${e.sets} ${e.sets === 1 ? 'set' : 'sets'} · ${formatTarget(t, e)}`;
}

// "6 exercises · 19 sets", or a quiet hint for an empty day.
export function daySummary(day: Pick<SplitDay, 'exercises'>) {
  const n = day.exercises.length;
  if (n === 0) return 'No exercises yet';
  const sets = day.exercises.reduce((sum, e) => sum + e.sets, 0);
  return `${n} ${n === 1 ? 'exercise' : 'exercises'} · ${sets} sets`;
}

export const dayTitle = (day: Pick<SplitDay, 'name'>) => day.name.trim() || 'New day';
